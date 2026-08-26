import type {
  PublicSlot,
  PublicView,
  Slot,
  SlotStatus,
  VehicleType,
} from "../types";
import { VEHICLE_TYPES, isSlotFree } from "../types";
import { dateKeyInZone, hourInZone } from "../time";

/**
 * The public availability projection.
 *
 * Anonymous visitors read ONE document rather than the slots collection. Three
 * reasons, in order of importance:
 *   1. it leaks nothing — no plate numbers, no fees, no arrival times;
 *   2. it costs one document read per visitor instead of one per slot;
 *   3. it is a single snapshot, so the count and the map can never disagree.
 *
 * It is rewritten inside the same transaction as every slot state change, so it
 * cannot drift out of step with the slots it describes.
 *
 * The slot's four states (§4) are carried through verbatim rather than
 * flattened to free/taken, because the design surfaces all four in its capacity
 * row — and "assigned" is genuinely useful to a driver, who can see that a
 * space is spoken for even though it looks empty.
 */

export function toPublicSlot(slot: Slot): PublicSlot {
  return {
    code: slot.code,
    level: slot.level,
    zone: slot.zone,
    section: slot.section,
    vehicleType: slot.vehicleType,
    status: slot.status,
  };
}

function emptyCounts(): Record<VehicleType, number> {
  return { car: 0, motorcycle: 0 };
}

export interface StatusCounts {
  available: number;
  assigned: number;
  occupied: number;
  outOfService: number;
  /** Usable capacity — everything except out-of-service. */
  total: number;
}

export function emptyStatusCounts(): StatusCounts {
  return { available: 0, assigned: 0, occupied: 0, outOfService: 0, total: 0 };
}

/**
 * Counts are always recomputed from the slot array rather than incremented, so
 * a bug in one transition cannot quietly accumulate into a wrong public number.
 */
export function countSlots(slots: PublicSlot[]): {
  freeByType: Record<VehicleType, number>;
  totalByType: Record<VehicleType, number>;
  statusCounts: StatusCounts;
} {
  const freeByType = emptyCounts();
  const totalByType = emptyCounts();
  const statusCounts = emptyStatusCounts();

  for (const slot of slots) {
    switch (slot.status) {
      case "available":
        statusCounts.available += 1;
        break;
      case "assigned":
        statusCounts.assigned += 1;
        break;
      case "occupied":
        statusCounts.occupied += 1;
        break;
      case "out_of_service":
        statusCounts.outOfService += 1;
        break;
    }

    if (!VEHICLE_TYPES.includes(slot.vehicleType)) continue;

    // Out-of-service slots are not part of the lot's usable capacity, so they
    // are excluded from the total as well as from the free count. Showing
    // "40 of 50 free" when 10 are flooded would misrepresent the lot.
    if (slot.status === "out_of_service") continue;

    totalByType[slot.vehicleType] += 1;
    statusCounts.total += 1;
    if (isSlotFree(slot.status)) freeByType[slot.vehicleType] += 1;
  }

  return { freeByType, totalByType, statusCounts };
}

export function occupancyPercent(
  freeByType: Record<VehicleType, number>,
  totalByType: Record<VehicleType, number>,
): number {
  const total = totalByType.car + totalByType.motorcycle;
  if (total === 0) return 0;
  const free = freeByType.car + freeByType.motorcycle;
  return Math.round(((total - free) / total) * 100);
}

/** Marker for an hour that has not happened yet today. */
export const HOUR_NOT_RECORDED = -1;

export function emptyHourlyOccupancy(): number[] {
  return Array.from({ length: 24 }, () => HOUR_NOT_RECORDED);
}

export interface OccupancyState {
  hourlyOccupancy: number[];
  /** Local calendar day the samples belong to, so we know when to reset. */
  occupancyDate: string;
}

/**
 * Samples current occupancy into the hour bucket it happened in. §7 asks for
 * "busiest hours"; this records what actually occurred rather than predicting.
 * The array resets when the lot's local day rolls over.
 */
export function sampleOccupancy(
  previous: OccupancyState | null,
  occupancy: number,
  at: Date,
  timeZone: string,
): OccupancyState {
  const today = dateKeyInZone(at, timeZone);
  const hour = hourInZone(at, timeZone);

  const hourlyOccupancy =
    previous && previous.occupancyDate === today
      ? [...previous.hourlyOccupancy]
      : emptyHourlyOccupancy();

  // Within an hour, keep the busiest reading — that is what "busiest hour" means.
  hourlyOccupancy[hour] = Math.max(
    hourlyOccupancy[hour] ?? HOUR_NOT_RECORDED,
    occupancy,
  );

  return { hourlyOccupancy, occupancyDate: today };
}

export interface BuildPublicViewInput {
  lotId: string;
  lotName: string;
  timeZone: string;
  slots: PublicSlot[];
  previousOccupancy: OccupancyState | null;
  at: Date;
}

export function buildPublicView(
  input: BuildPublicViewInput,
): PublicView & OccupancyState {
  const slots = [...input.slots];
  const { freeByType, totalByType, statusCounts } = countSlots(slots);
  const occupancy = sampleOccupancy(
    input.previousOccupancy,
    occupancyPercent(freeByType, totalByType),
    input.at,
    input.timeZone,
  );

  return {
    lotId: input.lotId,
    lotName: input.lotName,
    updatedAt: input.at,
    freeByType,
    totalByType,
    statusCounts,
    slots,
    ...occupancy,
  };
}

/**
 * Replaces one slot's status in an existing projection. Used on the hot path —
 * a vehicle arriving or leaving touches exactly one slot, so there is no need
 * to re-read the whole collection inside the transaction.
 */
export function withSlotStatus(
  slots: PublicSlot[],
  slotCode: string,
  status: SlotStatus,
): PublicSlot[] {
  return slots.map((slot) =>
    slot.code === slotCode ? { ...slot, status } : slot,
  );
}

/** Distinct levels in map order, for the floor selector. */
export function levelsOf(slots: PublicSlot[]): string[] {
  const seen: string[] = [];
  for (const slot of slots) {
    if (slot.level && !seen.includes(slot.level)) seen.push(slot.level);
  }
  return seen;
}

/** Distinct zones within a level. */
export function zonesOf(slots: PublicSlot[], level: string): string[] {
  const seen: string[] = [];
  for (const slot of slots) {
    if (slot.level !== level) continue;
    const zone = slot.zone || "";
    if (!seen.includes(zone)) seen.push(zone);
  }
  return seen;
}
