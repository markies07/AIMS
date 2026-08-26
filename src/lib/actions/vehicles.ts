"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import { requireLotAccess, requireOwnerOfLot } from "../auth/session";
import { computeFee } from "../billing/computeFee";
import { makePlate, rateFor, type FeeBreakdown } from "../types";
import { getActiveRate, toSession, toSlot } from "../data/lot";
import { dateKeyInZone } from "../time";
import { ActionError, runAction, type ActionResult } from "./result";
import { writeAudit } from "./audit";
import {
  readPublicViewState,
  updatePublicViewForSlot,
  updatePublicViewForSlots,
} from "./publicViewTx";

const plateSchema = z.object({
  emirate: z.string().trim().min(1).max(40),
  code: z.string().trim().max(10),
  number: z.string().trim().min(1).max(20),
});

const admitSchema = z.object({
  lotId: z.string().min(1),
  plate: plateSchema,
  vehicleType: z.enum(["car", "motorcycle"]),
  slotId: z.string().min(1),
  /**
   * §11 lists automatic plate cameras as a later addition. Accepting the source
   * now means adding LPR is one integration passing "camera" here, rather than
   * a schema migration across every historical session.
   */
  captureMethod: z.enum(["manual", "camera"]).default("manual"),
});

/**
 * §5 Step 2 — record an arriving vehicle and block a slot for it.
 *
 * The read-assert-write inside a single transaction is what makes §4's
 * "impossible — a slot is reserved the moment it is assigned" actually true.
 * Two attendants pressing assign on B-14 at the same instant: Firestore aborts
 * and retries the loser, whose re-read then sees `assigned` and fails cleanly
 * with `slotTaken`.
 */
export async function admitVehicle(
  input: z.input<typeof admitSchema>,
): Promise<ActionResult<{ sessionId: string; slotCode: string }>> {
  return runAction(async () => {
    const { lotId, plate, vehicleType, slotId, captureMethod } =
      admitSchema.parse(input);
    const user = await requireLotAccess(lotId);

    const rate = await getActiveRate(lotId);
    if (!rate) throw new ActionError("noRateConfigured");

    // One server-generated instant, used for the record, the audit entry and
    // the occupancy sample alike. Never the browser's clock — the browser is
    // where the person being billed is sitting.
    const now = new Date();

    const lotSnap = await adminDb.doc(paths.lot(lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    const result = await adminDb.runTransaction(async (tx) => {
      const slotRef = adminDb.doc(paths.slot(lotId, slotId));
      const viewRef = adminDb.doc(paths.publicView(lotId));

      // All reads before any write — a Firestore transaction requirement.
      const [slotSnap, viewSnap] = await Promise.all([
        tx.get(slotRef),
        tx.get(viewRef),
      ]);

      if (!slotSnap.exists) throw new ActionError("slotNotFound");
      const slot = toSlot(slotSnap.id, slotSnap.data()!);

      // The assertion that prevents two cars being sent to one space.
      if (slot.status !== "available") throw new ActionError("slotTaken");
      if (slot.vehicleType !== vehicleType)
        throw new ActionError("invalidState");

      const sessionRef = adminDb.collection(paths.sessions(lotId)).doc();

      tx.set(sessionRef, {
        plate: makePlate(plate),
        vehicleType,
        slotId: slot.id,
        slotCode: slot.code,
        status: "assigned",
        entryAt: Timestamp.fromDate(now),
        parkedAt: null,
        exitAt: null,
        // Snapshot the rate so a mid-stay price change never surprises a driver
        // who is already parked.
        rateSnapshot: {
          id: rate.id,
          effectiveFrom: Timestamp.fromDate(rate.effectiveFrom),
          car: rate.car,
          motorcycle: rate.motorcycle,
          vat: rate.vat,
        },
        fee: null,
        paidAt: null,
        attendantInUid: user.uid,
        attendantOutUid: null,
        receiptNo: null,
        captureMethod,
        lateEntry: false,
        discountFils: 0,
        discountReason: null,
        notes: null,
      });

      tx.update(slotRef, {
        status: "assigned",
        currentSessionId: sessionRef.id,
      });

      updatePublicViewForSlot(tx, {
        lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: slot.code,
        status: "assigned",
        at: now,
      });

      writeAudit(tx, lotId, {
        actor: user,
        action: "vehicle_in",
        target: sessionRef.id,
        at: now,
        details: { slot: slot.code, plate: makePlate(plate).normalized },
      });

      return { sessionId: sessionRef.id, slotCode: slot.code };
    });

    revalidateAll();
    return result;
  });
}

/** §5 Step 3 — the driver has actually parked. */
export async function confirmParked(input: {
  lotId: string;
  sessionId: string;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    const now = new Date();

    const lotSnap = await adminDb.doc(paths.lot(input.lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.doc(
        paths.session(input.lotId, input.sessionId),
      );
      const viewRef = adminDb.doc(paths.publicView(input.lotId));

      const [sessionSnap, viewSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(viewRef),
      ]);
      if (!sessionSnap.exists) throw new ActionError("sessionNotFound");

      const session = toSession(sessionSnap.id, sessionSnap.data()!);
      if (session.status !== "assigned") throw new ActionError("invalidState");

      tx.update(sessionRef, {
        status: "parked",
        parkedAt: Timestamp.fromDate(now),
      });
      tx.update(adminDb.doc(paths.slot(input.lotId, session.slotId)), {
        status: "occupied",
      });

      // The free count is unchanged by assigned -> occupied, but the projection
      // carries the slot's actual state, so it must move with it or the public
      // map would show the space as still merely reserved.
      updatePublicViewForSlot(tx, {
        lotId: input.lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: session.slotCode,
        status: "occupied",
        at: now,
      });

      writeAudit(tx, input.lotId, {
        actor: user,
        action: "vehicle_parked",
        target: session.id,
        at: now,
        details: { slot: session.slotCode },
      });
    });

    revalidateAll();
  });
}

/** §8 — "the driver changes their mind and leaves". The slot goes back to free. */
export async function cancelAssignment(input: {
  lotId: string;
  sessionId: string;
  reason?: string;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    const now = new Date();

    const lotSnap = await adminDb.doc(paths.lot(input.lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.doc(
        paths.session(input.lotId, input.sessionId),
      );
      const viewRef = adminDb.doc(paths.publicView(input.lotId));

      const [sessionSnap, viewSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(viewRef),
      ]);
      if (!sessionSnap.exists) throw new ActionError("sessionNotFound");

      const session = toSession(sessionSnap.id, sessionSnap.data()!);
      if (session.status !== "assigned") throw new ActionError("invalidState");

      tx.update(sessionRef, {
        status: "cancelled",
        exitAt: Timestamp.fromDate(now),
      });
      tx.update(adminDb.doc(paths.slot(input.lotId, session.slotId)), {
        status: "available",
        currentSessionId: null,
      });

      updatePublicViewForSlot(tx, {
        lotId: input.lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: session.slotCode,
        status: "available",
        at: now,
      });

      writeAudit(tx, input.lotId, {
        actor: user,
        action: "assignment_cancelled",
        target: session.id,
        at: now,
        details: { slot: session.slotCode, reason: input.reason ?? null },
      });
    });

    revalidateAll();
  });
}

/**
 * §8 — "the driver parks in the wrong slot". Free the old one, take the new
 * one, and keep the arrival time so billing is unaffected.
 */
export async function reassignSlot(input: {
  lotId: string;
  sessionId: string;
  newSlotId: string;
}): Promise<ActionResult<{ slotCode: string }>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    const now = new Date();

    const lotSnap = await adminDb.doc(paths.lot(input.lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    const result = await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.doc(
        paths.session(input.lotId, input.sessionId),
      );
      const newSlotRef = adminDb.doc(paths.slot(input.lotId, input.newSlotId));
      const viewRef = adminDb.doc(paths.publicView(input.lotId));

      const [sessionSnap, newSlotSnap, viewSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(newSlotRef),
        tx.get(viewRef),
      ]);

      if (!sessionSnap.exists) throw new ActionError("sessionNotFound");
      if (!newSlotSnap.exists) throw new ActionError("slotNotFound");

      const session = toSession(sessionSnap.id, sessionSnap.data()!);
      if (session.status !== "assigned" && session.status !== "parked") {
        throw new ActionError("invalidState");
      }

      const newSlot = toSlot(newSlotSnap.id, newSlotSnap.data()!);
      if (newSlot.status !== "available") throw new ActionError("slotTaken");

      const oldSlotRef = adminDb.doc(paths.slot(input.lotId, session.slotId));
      const previousView = readPublicViewState(viewSnap.data());
      const newSlotStatus =
        session.status === "parked" ? "occupied" : "assigned";

      tx.update(oldSlotRef, { status: "available", currentSessionId: null });
      tx.update(newSlotRef, {
        status: newSlotStatus,
        currentSessionId: session.id,
      });
      // entryAt deliberately untouched — the driver is not charged for our
      // paperwork.
      tx.update(sessionRef, { slotId: newSlot.id, slotCode: newSlot.code });

      // Both slots move in one projection write, so the map is never briefly
      // showing the car in two places or in neither.
      updatePublicViewForSlots(tx, {
        lotId: input.lotId,
        timeZone,
        previous: previousView,
        changes: [
          { slotCode: session.slotCode, status: "available" },
          { slotCode: newSlot.code, status: newSlotStatus },
        ],
        at: now,
      });

      writeAudit(tx, input.lotId, {
        actor: user,
        action: "slot_reassigned",
        target: session.id,
        at: now,
        details: { from: session.slotCode, to: newSlot.code },
      });

      return { slotCode: newSlot.code };
    });

    revalidateAll();
    return result;
  });
}

const checkOutSchema = z.object({
  lotId: z.string().min(1),
  sessionId: z.string().min(1),
  discountFils: z.number().int().min(0).optional(),
  discountReason: z.string().trim().max(300).optional(),
});

/**
 * §5 Step 5 — the exit. Computes the fee, records the cash, frees the slot.
 *
 * The fee is computed here from the stored arrival time and the rate that was
 * snapshotted at entry. The client never supplies an amount; it only displays
 * what this returns.
 */
export async function checkOutVehicle(
  input: z.input<typeof checkOutSchema>,
): Promise<
  ActionResult<{ receiptNo: string; fee: FeeBreakdown; slotCode: string }>
> {
  return runAction(async () => {
    const parsed = checkOutSchema.parse(input);
    const { lotId, sessionId } = parsed;

    // A discount is a goodwill decision about money — owner only (§8).
    const user =
      parsed.discountFils && parsed.discountFils > 0
        ? await requireOwnerOfLot(lotId)
        : await requireLotAccess(lotId);

    if (
      parsed.discountFils &&
      parsed.discountFils > 0 &&
      !parsed.discountReason
    ) {
      throw new ActionError("reasonRequired");
    }

    const now = new Date();
    const lotSnap = await adminDb.doc(paths.lot(lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    const result = await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.doc(paths.session(lotId, sessionId));
      const viewRef = adminDb.doc(paths.publicView(lotId));
      const counterRef = adminDb.doc(paths.receiptCounter(lotId));

      const [sessionSnap, viewSnap, counterSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(viewRef),
        tx.get(counterRef),
      ]);

      if (!sessionSnap.exists) throw new ActionError("sessionNotFound");
      const session = toSession(sessionSnap.id, sessionSnap.data()!);

      if (session.status === "completed")
        throw new ActionError("alreadyCompleted");
      if (session.status === "cancelled") throw new ActionError("invalidState");

      const rate = rateFor(session.rateSnapshot, session.vehicleType);
      const fee = computeFee({
        entryAt: session.entryAt,
        exitAt: now,
        rate,
        vat: session.rateSnapshot.vat,
        discountFils: parsed.discountFils ?? 0,
      });

      const nextSeq = (counterSnap.data()?.seq ?? 0) + 1;
      const receiptNo = `${dateKeyInZone(now, timeZone).replace(/-/g, "")}-${String(
        nextSeq,
      ).padStart(5, "0")}`;

      tx.set(counterRef, { seq: nextSeq }, { merge: true });

      tx.update(sessionRef, {
        status: "completed",
        exitAt: Timestamp.fromDate(now),
        paidAt: Timestamp.fromDate(now),
        fee,
        receiptNo,
        attendantOutUid: user.uid,
        discountFils: parsed.discountFils ?? 0,
        discountReason: parsed.discountReason ?? null,
      });

      tx.update(adminDb.doc(paths.slot(lotId, session.slotId)), {
        status: "available",
        currentSessionId: null,
      });

      updatePublicViewForSlot(tx, {
        lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: session.slotCode,
        status: "available",
        at: now,
      });

      writeAudit(tx, lotId, {
        actor: user,
        action: "vehicle_out",
        target: session.id,
        at: now,
        details: {
          slot: session.slotCode,
          receiptNo,
          totalFils: fee.totalFils,
          discountFils: parsed.discountFils ?? 0,
        },
      });

      if (parsed.discountFils && parsed.discountFils > 0) {
        writeAudit(tx, lotId, {
          actor: user,
          action: "discount_applied",
          target: session.id,
          at: now,
          details: {
            amountFils: parsed.discountFils,
            reason: parsed.discountReason ?? null,
          },
        });
      }

      return { receiptNo, fee, slotCode: session.slotCode };
    });

    revalidateAll();
    return result;
  });
}

/**
 * §5 Step 4 — what a still-parked vehicle owes right now.
 *
 * Advisory only. The binding amount is the one `checkOutVehicle` computes at
 * the moment payment is recorded, because time keeps passing while the
 * attendant and driver talk. The two can differ if an hour boundary is crossed
 * in between, which is why the receipt prints the actual times alongside the
 * total.
 */
export async function quoteExitFee(input: {
  lotId: string;
  sessionId: string;
}): Promise<
  ActionResult<{ fee: FeeBreakdown; asOfMs: number; entryAtMs: number }>
> {
  return runAction(async () => {
    await requireLotAccess(input.lotId);

    const snap = await adminDb
      .doc(paths.session(input.lotId, input.sessionId))
      .get();
    if (!snap.exists) throw new ActionError("sessionNotFound");

    const session = toSession(snap.id, snap.data()!);
    if (session.status === "completed")
      throw new ActionError("alreadyCompleted");
    if (session.status === "cancelled") throw new ActionError("invalidState");

    const now = new Date();
    const fee = computeFee({
      entryAt: session.entryAt,
      exitAt: now,
      rate: rateFor(session.rateSnapshot, session.vehicleType),
      vat: session.rateSnapshot.vat,
    });

    return {
      fee,
      asOfMs: now.getTime(),
      entryAtMs: session.entryAt.getTime(),
    };
  });
}

/** §8 — "wrong plate number typed". The correction is recorded. */
export async function correctPlate(input: {
  lotId: string;
  sessionId: string;
  plate: { emirate: string; code: string; number: string };
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    const plate = makePlate(plateSchema.parse(input.plate));
    const now = new Date();

    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.doc(
        paths.session(input.lotId, input.sessionId),
      );
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw new ActionError("sessionNotFound");

      const before = toSession(snap.id, snap.data()!);
      tx.update(sessionRef, { plate });

      writeAudit(tx, input.lotId, {
        actor: user,
        action: "plate_corrected",
        target: before.id,
        at: now,
        details: { from: before.plate.normalized, to: plate.normalized },
      });
    });

    revalidateAll();
  });
}

const manualEntrySchema = z.object({
  lotId: z.string().min(1),
  plate: plateSchema,
  vehicleType: z.enum(["car", "motorcycle"]),
  slotId: z.string().min(1),
  entryAtMs: z.number().int(),
  reason: z.string().trim().min(1).max(300),
});

/**
 * §8 — two situations, one mechanism:
 *   "a car at the exit has no record" → the owner creates it, reason noted;
 *   "the internet goes down" → paper notes are entered once it returns.
 *
 * Owner-only, because the entry time is supplied by hand and the entry time is
 * what the bill is computed from. A reason is mandatory, and every such record
 * is flagged `lateEntry` so it stands out in the history rather than blending
 * in with the automatic ones.
 */
export async function createManualEntry(
  input: z.input<typeof manualEntrySchema>,
): Promise<ActionResult<{ sessionId: string }>> {
  return runAction(async () => {
    const args = manualEntrySchema.parse(input);
    const user = await requireOwnerOfLot(args.lotId);

    const entryAt = new Date(args.entryAtMs);
    const now = new Date();

    // A back-dated entry is expected; a future one would bill negative time.
    if (entryAt.getTime() > now.getTime())
      throw new ActionError("invalidState");

    const rate = await getActiveRate(args.lotId, entryAt);
    if (!rate) throw new ActionError("noRateConfigured");

    const lotSnap = await adminDb.doc(paths.lot(args.lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    const result = await adminDb.runTransaction(async (tx) => {
      const slotRef = adminDb.doc(paths.slot(args.lotId, args.slotId));
      const viewRef = adminDb.doc(paths.publicView(args.lotId));

      const [slotSnap, viewSnap] = await Promise.all([
        tx.get(slotRef),
        tx.get(viewRef),
      ]);
      if (!slotSnap.exists) throw new ActionError("slotNotFound");

      const slot = toSlot(slotSnap.id, slotSnap.data()!);
      if (slot.status !== "available") throw new ActionError("slotTaken");

      const sessionRef = adminDb.collection(paths.sessions(args.lotId)).doc();

      tx.set(sessionRef, {
        plate: makePlate(args.plate),
        vehicleType: args.vehicleType,
        slotId: slot.id,
        slotCode: slot.code,
        status: "parked",
        entryAt: Timestamp.fromDate(entryAt),
        parkedAt: Timestamp.fromDate(entryAt),
        exitAt: null,
        rateSnapshot: {
          id: rate.id,
          effectiveFrom: Timestamp.fromDate(rate.effectiveFrom),
          car: rate.car,
          motorcycle: rate.motorcycle,
          vat: rate.vat,
        },
        fee: null,
        paidAt: null,
        attendantInUid: user.uid,
        attendantOutUid: null,
        receiptNo: null,
        captureMethod: "manual",
        lateEntry: true,
        discountFils: 0,
        discountReason: null,
        notes: args.reason,
      });

      tx.update(slotRef, {
        status: "occupied",
        currentSessionId: sessionRef.id,
      });

      updatePublicViewForSlot(tx, {
        lotId: args.lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: slot.code,
        status: "occupied",
        at: now,
      });

      writeAudit(tx, args.lotId, {
        actor: user,
        action: "manual_entry_created",
        target: sessionRef.id,
        at: now,
        details: {
          slot: slot.code,
          plate: makePlate(args.plate).normalized,
          entryAt: entryAt.toISOString(),
          reason: args.reason,
        },
      });

      return { sessionId: sessionRef.id };
    });

    revalidateAll();
    return result;
  });
}

/**
 * §8 — the lot is full and a car is turned away. Counting these gives the owner
 * evidence of lost business when deciding whether to expand.
 */
export async function recordTurnaway(input: {
  lotId: string;
  vehicleType: "car" | "motorcycle";
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    const now = new Date();

    await adminDb.collection(paths.turnaways(input.lotId)).add({
      vehicleType: input.vehicleType,
      attendantUid: user.uid,
      at: Timestamp.fromDate(now),
    });

    revalidateAll();
  });
}

function revalidateAll(): void {
  revalidatePath("/", "layout");
}
