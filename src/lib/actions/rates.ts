"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import { requireOwnerOfLot } from "../auth/session";
import { runAction, type ActionResult } from "./result";

const vehicleRateSchema = z.object({
  firstHourFils: z.number().int().min(0),
  subsequentHourFils: z.number().int().min(0),
  graceMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  dailyMaxFils: z.number().int().min(0).nullable(),
});

const rateSchema = z.object({
  lotId: z.string().min(1),
  effectiveFromMs: z.number().int(),
  car: vehicleRateSchema,
  motorcycle: vehicleRateSchema,
  vat: z.object({
    registered: z.boolean(),
    ratePercent: z.number().min(0).max(100),
    pricesIncludeVat: z.boolean(),
  }),
});

/**
 * §7 — change the prices.
 *
 * Rates are VERSIONED, never edited in place. Three reasons this matters:
 *   - a completed session must always be explicable against the price that was
 *     in force when it happened, for any dispute or audit;
 *   - a vehicle already parked keeps the rate it arrived on, because its
 *     session snapshotted it at entry;
 *   - the owner can schedule a change ahead of time.
 */
export async function createRateVersion(
  input: z.input<typeof rateSchema>,
): Promise<ActionResult<{ rateId: string }>> {
  return runAction(async () => {
    const args = rateSchema.parse(input);
    const user = await requireOwnerOfLot(args.lotId);

    const now = new Date();
    const effectiveFrom = new Date(args.effectiveFromMs);

    const ref = adminDb.collection(paths.rates(args.lotId)).doc();
    await ref.set({
      effectiveFrom: Timestamp.fromDate(effectiveFrom),
      car: args.car,
      motorcycle: args.motorcycle,
      vat: args.vat,
      createdAt: Timestamp.fromDate(now),
      createdByUid: user.uid,
    });

    await adminDb.collection(paths.auditLog(args.lotId)).add({
      actorUid: user.uid,
      actorName: user.displayName || user.email,
      actorRole: user.role,
      action: "rate_version_created",
      target: ref.id,
      details: {
        effectiveFrom: effectiveFrom.toISOString(),
        carFirstHourFils: args.car.firstHourFils,
        motorcycleFirstHourFils: args.motorcycle.firstHourFils,
        vatRegistered: args.vat.registered,
      },
      at: Timestamp.fromDate(now),
    });

    revalidatePath("/", "layout");
    return { rateId: ref.id };
  });
}
