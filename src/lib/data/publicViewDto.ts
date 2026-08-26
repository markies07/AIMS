import type { PublicSlot, PublicView, VehicleType } from "../types";
import {
  emptyHourlyOccupancy,
  emptyStatusCounts,
  type StatusCounts,
} from "./publicView";

/**
 * The shape crossing the server/client boundary and arriving from `onSnapshot`.
 *
 * Timestamps become plain milliseconds so the exact same object can come from a
 * server render or from a live client subscription without either side having
 * to know about Firestore's `Timestamp` class.
 */
export interface PublicViewDTO {
  lotId: string;
  lotName: string;
  updatedAtMs: number;
  freeByType: Record<VehicleType, number>;
  totalByType: Record<VehicleType, number>;
  statusCounts: StatusCounts;
  slots: PublicSlot[];
  hourlyOccupancy: number[];
}

export function toDto(view: PublicView): PublicViewDTO {
  return {
    lotId: view.lotId,
    lotName: view.lotName,
    updatedAtMs: view.updatedAt.getTime(),
    freeByType: view.freeByType,
    totalByType: view.totalByType,
    statusCounts: view.statusCounts,
    slots: view.slots,
    hourlyOccupancy: view.hourlyOccupancy,
  };
}

/** Converts a raw client-SDK document into the same DTO. */
export function dtoFromRaw(
  lotId: string,
  data: Record<string, unknown> | undefined,
): PublicViewDTO | null {
  if (!data) return null;

  const updatedAt = data.updatedAt as { toMillis?: () => number } | undefined;

  return {
    lotId,
    lotName: (data.lotName as string) ?? "Parking",
    updatedAtMs: updatedAt?.toMillis ? updatedAt.toMillis() : Date.now(),
    freeByType: (data.freeByType as Record<VehicleType, number>) ?? {
      car: 0,
      motorcycle: 0,
    },
    totalByType: (data.totalByType as Record<VehicleType, number>) ?? {
      car: 0,
      motorcycle: 0,
    },
    statusCounts: (data.statusCounts as StatusCounts) ?? emptyStatusCounts(),
    slots: (data.slots as PublicSlot[]) ?? [],
    hourlyOccupancy:
      (data.hourlyOccupancy as number[]) ?? emptyHourlyOccupancy(),
  };
}

export { levelsOf, zonesOf } from "./publicView";
