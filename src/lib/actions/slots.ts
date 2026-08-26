"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import { requireLotAccess, requireOwnerOfLot } from "../auth/session";
import { toSlot } from "../data/lot";
import { toPublicSlot } from "../data/publicView";
import type { Slot } from "../types";
import { ActionError, runAction, type ActionResult } from "./result";
import { writeAudit } from "./audit";
import {
  readPublicViewState,
  rebuildPublicView,
  updatePublicViewForSlot,
} from "./publicViewTx";

/**
 * §8 — "a slot becomes unusable". It stops being counted as available and
 * carries the reason, so the owner can see why capacity dropped.
 */
export async function markOutOfService(input: {
  lotId: string;
  slotId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    if (!input.reason.trim()) throw new ActionError("reasonRequired");

    const now = new Date();
    const lotSnap = await adminDb.doc(paths.lot(input.lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    await adminDb.runTransaction(async (tx) => {
      const slotRef = adminDb.doc(paths.slot(input.lotId, input.slotId));
      const viewRef = adminDb.doc(paths.publicView(input.lotId));

      const [slotSnap, viewSnap] = await Promise.all([
        tx.get(slotRef),
        tx.get(viewRef),
      ]);
      if (!slotSnap.exists) throw new ActionError("slotNotFound");

      const slot = toSlot(slotSnap.id, slotSnap.data()!);
      // A slot with a car in it cannot be closed — the vehicle has to leave
      // first, or its session would be orphaned.
      if (slot.status === "assigned" || slot.status === "occupied") {
        throw new ActionError("invalidState");
      }

      tx.update(slotRef, {
        status: "out_of_service",
        outOfServiceReason: input.reason.trim(),
      });

      updatePublicViewForSlot(tx, {
        lotId: input.lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: slot.code,
        status: "out_of_service",
        at: now,
      });

      writeAudit(tx, input.lotId, {
        actor: user,
        action: "slot_out_of_service",
        target: slot.id,
        at: now,
        details: { slot: slot.code, reason: input.reason.trim() },
      });
    });

    revalidatePath("/", "layout");
  });
}

export async function returnToService(input: {
  lotId: string;
  slotId: string;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireLotAccess(input.lotId);
    const now = new Date();

    const lotSnap = await adminDb.doc(paths.lot(input.lotId)).get();
    const timeZone = lotSnap.get("timeZone") ?? "Asia/Dubai";

    await adminDb.runTransaction(async (tx) => {
      const slotRef = adminDb.doc(paths.slot(input.lotId, input.slotId));
      const viewRef = adminDb.doc(paths.publicView(input.lotId));

      const [slotSnap, viewSnap] = await Promise.all([
        tx.get(slotRef),
        tx.get(viewRef),
      ]);
      if (!slotSnap.exists) throw new ActionError("slotNotFound");

      const slot = toSlot(slotSnap.id, slotSnap.data()!);
      if (slot.status !== "out_of_service")
        throw new ActionError("invalidState");

      tx.update(slotRef, { status: "available", outOfServiceReason: null });

      updatePublicViewForSlot(tx, {
        lotId: input.lotId,
        timeZone,
        previous: readPublicViewState(viewSnap.data()),
        slotCode: slot.code,
        status: "available",
        at: now,
      });

      writeAudit(tx, input.lotId, {
        actor: user,
        action: "slot_returned_to_service",
        target: slot.id,
        at: now,
        details: { slot: slot.code },
      });
    });

    revalidatePath("/", "layout");
  });
}

const bulkSchema = z.object({
  lotId: z.string().min(1),
  level: z.string().trim().min(1).max(40),
  zone: z.string().trim().max(40).default(""),
  section: z.string().trim().max(40),
  prefix: z.string().trim().min(1).max(8),
  from: z.number().int().min(0).max(9999),
  to: z.number().int().min(0).max(9999),
  vehicleType: z.enum(["car", "motorcycle"]),
});

/**
 * §7 — bulk slot creation. Nobody is going to type two hundred slot codes one
 * at a time, and making them do so guarantees typos against the numbers
 * actually painted on the ground.
 */
export async function createSlotsBulk(
  input: z.input<typeof bulkSchema>,
): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const args = bulkSchema.parse(input);
    const user = await requireOwnerOfLot(args.lotId);

    if (args.to < args.from) throw new ActionError("invalidState");
    if (args.to - args.from > 500) throw new ActionError("invalidState");

    const now = new Date();
    const existing = await adminDb.collection(paths.slots(args.lotId)).get();
    let sortOrder = existing.size;

    const batch = adminDb.batch();
    let created = 0;

    for (let n = args.from; n <= args.to; n++) {
      const code = `${args.prefix}-${String(n).padStart(2, "0")}`;
      const id = code.toLowerCase().replace(/[^a-z0-9-]/g, "");

      if (existing.docs.some((d) => d.id === id)) continue;

      batch.set(adminDb.doc(paths.slot(args.lotId, id)), {
        code,
        level: args.level,
        zone: args.zone,
        section: args.section,
        vehicleType: args.vehicleType,
        status: "available",
        currentSessionId: null,
        outOfServiceReason: null,
        sortOrder: sortOrder++,
      });
      created++;
    }

    await batch.commit();

    // The lot's shape changed, so the projection is rebuilt from scratch
    // rather than patched.
    await refreshProjection(args.lotId);

    await adminDb.collection(paths.auditLog(args.lotId)).add({
      actorUid: user.uid,
      actorName: user.displayName || user.email,
      actorRole: user.role,
      action: "slot_created",
      target: `${args.prefix}-${args.from}..${args.to}`,
      details: { created, level: args.level, vehicleType: args.vehicleType },
      at: now,
    });

    revalidatePath("/", "layout");
    return { created };
  });
}

/**
 * Retires a slot. Only ever an empty one — removing a space with a car in it
 * would strand a live session and lose the money owed on it.
 */
export async function retireSlot(input: {
  lotId: string;
  slotId: string;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const user = await requireOwnerOfLot(input.lotId);
    const now = new Date();

    const ref = adminDb.doc(paths.slot(input.lotId, input.slotId));
    const snap = await ref.get();
    if (!snap.exists) throw new ActionError("slotNotFound");

    const slot = toSlot(snap.id, snap.data()!);
    if (slot.status === "assigned" || slot.status === "occupied") {
      throw new ActionError("invalidState");
    }

    await ref.delete();
    await refreshProjection(input.lotId);

    await adminDb.collection(paths.auditLog(input.lotId)).add({
      actorUid: user.uid,
      actorName: user.displayName || user.email,
      actorRole: user.role,
      action: "slot_retired",
      target: slot.id,
      details: { slot: slot.code },
      at: now,
    });

    revalidatePath("/", "layout");
  });
}

async function refreshProjection(lotId: string): Promise<void> {
  const [lotSnap, slotSnap] = await Promise.all([
    adminDb.doc(paths.lot(lotId)).get(),
    adminDb.collection(paths.slots(lotId)).orderBy("sortOrder").get(),
  ]);

  const slots: Slot[] = slotSnap.docs.map((d) => toSlot(d.id, d.data()));

  await rebuildPublicView({
    lotId,
    lotName: lotSnap.get("name") ?? "Parking",
    timeZone: lotSnap.get("timeZone") ?? "Asia/Dubai",
    slots: slots.map(toPublicSlot),
  });
}
