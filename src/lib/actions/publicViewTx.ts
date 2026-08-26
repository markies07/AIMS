import "server-only";

import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import type { PublicSlot, SlotStatus } from "../types";
import {
  countSlots,
  emptyHourlyOccupancy,
  occupancyPercent,
  sampleOccupancy,
  withSlotStatus,
} from "../data/publicView";
import { dateKeyInZone } from "../time";

export interface PublicViewState {
  slots: PublicSlot[];
  hourlyOccupancy: number[];
  occupancyDate: string;
}

export function readPublicViewState(
  data: FirebaseFirestore.DocumentData | undefined,
): PublicViewState {
  return {
    slots: (data?.slots as PublicSlot[]) ?? [],
    hourlyOccupancy:
      (data?.hourlyOccupancy as number[]) ?? emptyHourlyOccupancy(),
    occupancyDate: (data?.occupancyDate as string) ?? "",
  };
}

function write(
  tx: Transaction,
  lotId: string,
  slots: PublicSlot[],
  previous: PublicViewState,
  timeZone: string,
  at: Date,
): void {
  const { freeByType, totalByType, statusCounts } = countSlots(slots);

  const occupancy = sampleOccupancy(
    {
      hourlyOccupancy: previous.hourlyOccupancy,
      occupancyDate: previous.occupancyDate,
    },
    occupancyPercent(freeByType, totalByType),
    at,
    timeZone,
  );

  tx.set(
    adminDb.doc(paths.publicView(lotId)),
    {
      lotId,
      slots,
      freeByType,
      totalByType,
      statusCounts,
      hourlyOccupancy: occupancy.hourlyOccupancy,
      occupancyDate: occupancy.occupancyDate,
      updatedAt: Timestamp.fromDate(at),
    },
    { merge: true },
  );
}

/**
 * Rewrites the public projection inside the caller's transaction, after slots
 * changed state.
 *
 * Doing this in the same transaction as the slot write is the whole reason the
 * public number can be trusted: there is no window in which the map says one
 * thing and the slots say another, and no background job that can fall behind.
 */
export function updatePublicViewForSlot(
  tx: Transaction,
  args: {
    lotId: string;
    timeZone: string;
    previous: PublicViewState;
    slotCode: string;
    status: SlotStatus;
    at: Date;
  },
): void {
  const slots = withSlotStatus(args.previous.slots, args.slotCode, args.status);
  write(tx, args.lotId, slots, args.previous, args.timeZone, args.at);
}

/** Two slots changing at once — a reassignment frees one and claims another. */
export function updatePublicViewForSlots(
  tx: Transaction,
  args: {
    lotId: string;
    timeZone: string;
    previous: PublicViewState;
    changes: { slotCode: string; status: SlotStatus }[];
    at: Date;
  },
): void {
  let slots = args.previous.slots;
  for (const change of args.changes) {
    slots = withSlotStatus(slots, change.slotCode, change.status);
  }
  write(tx, args.lotId, slots, args.previous, args.timeZone, args.at);
}

/**
 * Full rebuild from the slots collection. Used when the *shape* of the lot
 * changes — slots added, retired or renumbered — rather than on the hot path.
 */
export async function rebuildPublicView(args: {
  lotId: string;
  lotName: string;
  timeZone: string;
  slots: PublicSlot[];
  at?: Date;
}): Promise<void> {
  const at = args.at ?? new Date();
  const ref = adminDb.doc(paths.publicView(args.lotId));
  const existing = await ref.get();
  const previous = readPublicViewState(existing.data());

  const { freeByType, totalByType, statusCounts } = countSlots(args.slots);
  const occupancy = sampleOccupancy(
    previous.occupancyDate
      ? previous
      : {
          hourlyOccupancy: emptyHourlyOccupancy(),
          occupancyDate: dateKeyInZone(at, args.timeZone),
        },
    occupancyPercent(freeByType, totalByType),
    at,
    args.timeZone,
  );

  await ref.set({
    lotId: args.lotId,
    lotName: args.lotName,
    slots: args.slots,
    freeByType,
    totalByType,
    statusCounts,
    hourlyOccupancy: occupancy.hourlyOccupancy,
    occupancyDate: occupancy.occupancyDate,
    updatedAt: Timestamp.fromDate(at),
  });
}
