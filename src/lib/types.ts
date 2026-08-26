import type { Fils } from "./money";

/* ------------------------------------------------------------------ *
 * Vehicles, slots, sessions
 * ------------------------------------------------------------------ */

/** Concept doc §6 assumes exactly two rate classes. */
export const VEHICLE_TYPES = ["car", "motorcycle"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/**
 * Concept doc §4 — the four states. `assigned` is the important one: it blocks
 * the slot during the gap between the attendant saying "go to B-14" and the
 * driver actually parking there, which is what makes double-assignment
 * impossible.
 */
export const SLOT_STATUSES = [
  "available",
  "assigned",
  "occupied",
  "out_of_service",
] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

/** Only `available` slots are offered to a driver or counted as free. */
export function isSlotFree(status: SlotStatus): boolean {
  return status === "available";
}

export type SessionStatus = "assigned" | "parked" | "completed" | "cancelled";

/** Where a plate number came from. */
export const PLATE_CAPTURE_METHODS = ["manual", "camera"] as const;
export type PlateCaptureMethod = (typeof PLATE_CAPTURE_METHODS)[number];

export type Role = "attendant" | "owner";

/* ------------------------------------------------------------------ *
 * Plates
 * ------------------------------------------------------------------ */

/**
 * UAE plates are an emirate + a code + a number (e.g. Dubai · A · 12345), and
 * §9 asks for them as separate fields so that search actually works. Cars from
 * other emirates and neighbouring countries use the lot too, so `emirate` is a
 * free string rather than a closed union.
 */
export interface Plate {
  emirate: string;
  code: string;
  number: string;
  /** Lowercased, non-alphanumerics stripped — the field search runs against. */
  normalized: string;
}

export function normalizePlate(parts: {
  emirate: string;
  code: string;
  number: string;
}): string {
  return [parts.emirate, parts.code, parts.number]
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function makePlate(parts: {
  emirate: string;
  code: string;
  number: string;
}): Plate {
  return {
    emirate: parts.emirate.trim(),
    code: parts.code.trim().toUpperCase(),
    number: parts.number.trim(),
    normalized: normalizePlate(parts),
  };
}

export function formatPlate(plate: Plate): string {
  return [plate.emirate, plate.code, plate.number].filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------ *
 * Rates
 * ------------------------------------------------------------------ */

export interface VehicleRate {
  firstHourFils: Fils;
  subsequentHourFils: Fils;
  /** Stays at or under this are free. §6: "first 15 minutes". */
  graceMinutes: number;
  /** Cap per rolling 24h from entry. `null` = uncapped. */
  dailyMaxFils: Fils | null;
}

export interface VatConfig {
  /** §9 — we need to know whether the business is VAT-registered. */
  registered: boolean;
  /** UAE standard rate is 5. */
  ratePercent: number;
  /** Whether posted prices already contain the VAT. Changes the receipt. */
  pricesIncludeVat: boolean;
}

export interface Rate {
  id: string;
  /** Rates are versioned, never edited destructively. */
  effectiveFrom: Date;
  car: VehicleRate;
  motorcycle: VehicleRate;
  vat: VatConfig;
}

export type RateSnapshot = Omit<Rate, "effectiveFrom"> & {
  effectiveFrom: Date;
};

export function rateFor(rate: Rate, vehicleType: VehicleType): VehicleRate {
  return vehicleType === "car" ? rate.car : rate.motorcycle;
}

/* ------------------------------------------------------------------ *
 * Fee breakdown
 * ------------------------------------------------------------------ */

export type FeeLineKind =
  "grace" | "first_hour" | "additional_hours" | "daily_cap";

export interface FeeLine {
  kind: FeeLineKind;
  label: string;
  quantity: number;
  unitFils: Fils;
  amountFils: Fils;
  /** 0-based rolling-24h window this line belongs to. */
  dayIndex: number;
}

/**
 * §6 hinges on being able to show the driver the arithmetic — "most parking
 * disputes disappear the moment the customer can see the maths" — so the
 * breakdown is itemised, not just a total.
 */
export interface FeeBreakdown {
  durationMinutes: number;
  billedHours: number;
  lines: FeeLine[];
  /** Excluding VAT. */
  netFils: Fils;
  vatFils: Fils;
  /** What the driver actually hands over. */
  totalFils: Fils;
  capApplied: boolean;
  withinGrace: boolean;
}

/* ------------------------------------------------------------------ *
 * Documents
 * ------------------------------------------------------------------ */

export interface Slot {
  id: string;
  code: string;
  level: string;
  /** Zone within the level — "Zone A", "Zone B". Groups the floor plan. */
  zone: string;
  section: string;
  vehicleType: VehicleType;
  status: SlotStatus;
  currentSessionId: string | null;
  outOfServiceReason: string | null;
  sortOrder: number;
}

export interface ParkingSession {
  id: string;
  plate: Plate;
  vehicleType: VehicleType;
  slotId: string;
  slotCode: string;
  status: SessionStatus;
  entryAt: Date;
  parkedAt: Date | null;
  exitAt: Date | null;
  rateSnapshot: RateSnapshot;
  fee: FeeBreakdown | null;
  paidAt: Date | null;
  attendantInUid: string;
  attendantOutUid: string | null;
  receiptNo: string | null;
  /**
   * How the plate reached the system. §11 lists automatic plate cameras as a
   * later addition; recording the source now means adding LPR is one
   * integration writing "camera" here, not a schema change.
   */
  captureMethod: PlateCaptureMethod;
  /** §8 — entered from paper after an outage. */
  lateEntry: boolean;
  discountFils: Fils;
  discountReason: string | null;
  notes: string | null;
}

/** The single document anonymous visitors read. Contains no plates, no fees. */
export interface PublicView {
  lotId: string;
  lotName: string;
  updatedAt: Date;
  freeByType: Record<VehicleType, number>;
  totalByType: Record<VehicleType, number>;
  statusCounts: {
    available: number;
    assigned: number;
    occupied: number;
    outOfService: number;
    total: number;
  };
  slots: PublicSlot[];
  /** 24 entries, index = hour of day in the lot's timezone. */
  hourlyOccupancy: number[];
}

export interface PublicSlot {
  code: string;
  level: string;
  zone: string;
  section: string;
  vehicleType: VehicleType;
  /** All four states from §4 — the design surfaces every one of them. */
  status: SlotStatus;
}

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  lotIds: string[];
  active: boolean;
}
