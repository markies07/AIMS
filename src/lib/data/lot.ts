import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import { LOT_TIMEZONE } from "../time";
import type {
  ParkingSession,
  PublicView,
  Rate,
  Slot,
  UserRecord,
  VehicleType,
} from "../types";
import { emptyHourlyOccupancy, emptyStatusCounts } from "./publicView";

/* ------------------------------------------------------------------ *
 * Conversion
 * ------------------------------------------------------------------ */

type Data = FirebaseFirestore.DocumentData;

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function requireDate(value: unknown, field: string): Date {
  const date = toDate(value);
  if (!date) throw new Error(`Expected a timestamp at "${field}"`);
  return date;
}

export interface LotProfile {
  id: string;
  name: string;
  address: string;
  timeZone: string;
  currency: string;
  open24: boolean;
  opensAt: string | null;
  closesAt: string | null;
  /** Explicit maps link, or derived from the address if not set. */
  mapsUrl: string | null;
}

function mapsUrlFor(data: Data): string | null {
  if (typeof data.mapsUrl === "string" && data.mapsUrl) return data.mapsUrl;
  if (typeof data.address === "string" && data.address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      data.address,
    )}`;
  }
  return null;
}

export function toLotProfile(id: string, data: Data): LotProfile {
  return {
    id,
    name: data.name ?? "Parking",
    address: data.address ?? "",
    timeZone: data.timeZone ?? LOT_TIMEZONE,
    currency: data.currency ?? "AED",
    open24: data.open24 ?? true,
    opensAt: data.opensAt ?? null,
    closesAt: data.closesAt ?? null,
    mapsUrl: mapsUrlFor(data),
  };
}

export function toSlot(id: string, data: Data): Slot {
  return {
    id,
    code: data.code,
    level: data.level ?? "",
    zone: data.zone ?? "",
    section: data.section ?? "",
    vehicleType: data.vehicleType as VehicleType,
    status: data.status,
    currentSessionId: data.currentSessionId ?? null,
    outOfServiceReason: data.outOfServiceReason ?? null,
    sortOrder: data.sortOrder ?? 0,
  };
}

export function toRate(id: string, data: Data): Rate {
  return {
    id,
    effectiveFrom: requireDate(data.effectiveFrom, "effectiveFrom"),
    car: data.car,
    motorcycle: data.motorcycle,
    vat: data.vat,
  };
}

export function toSession(id: string, data: Data): ParkingSession {
  return {
    id,
    plate: data.plate,
    vehicleType: data.vehicleType,
    slotId: data.slotId,
    slotCode: data.slotCode,
    status: data.status,
    entryAt: requireDate(data.entryAt, "entryAt"),
    parkedAt: toDate(data.parkedAt),
    exitAt: toDate(data.exitAt),
    rateSnapshot: {
      ...data.rateSnapshot,
      effectiveFrom: toDate(data.rateSnapshot?.effectiveFrom) ?? new Date(0),
    },
    fee: data.fee ?? null,
    paidAt: toDate(data.paidAt),
    attendantInUid: data.attendantInUid,
    attendantOutUid: data.attendantOutUid ?? null,
    receiptNo: data.receiptNo ?? null,
    captureMethod: data.captureMethod ?? "manual",
    lateEntry: data.lateEntry ?? false,
    discountFils: data.discountFils ?? 0,
    discountReason: data.discountReason ?? null,
    notes: data.notes ?? null,
  };
}

export function toPublicView(data: Data): PublicView {
  return {
    lotId: data.lotId,
    lotName: data.lotName ?? "Parking",
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
    freeByType: data.freeByType ?? { car: 0, motorcycle: 0 },
    totalByType: data.totalByType ?? { car: 0, motorcycle: 0 },
    statusCounts: data.statusCounts ?? emptyStatusCounts(),
    slots: data.slots ?? [],
    hourlyOccupancy: data.hourlyOccupancy ?? emptyHourlyOccupancy(),
  };
}

export function toUserRecord(uid: string, data: Data): UserRecord {
  return {
    uid,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    role: data.role,
    lotIds: data.lotIds ?? [],
    active: data.active ?? true,
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function getLotProfile(lotId: string): Promise<LotProfile | null> {
  const snap = await adminDb.doc(paths.lot(lotId)).get();
  if (!snap.exists) return null;
  return toLotProfile(snap.id, snap.data()!);
}

export async function getPublicView(lotId: string): Promise<PublicView | null> {
  const snap = await adminDb.doc(paths.publicView(lotId)).get();
  if (!snap.exists) return null;
  return toPublicView(snap.data()!);
}

/**
 * The rate in force at `at` — the newest version whose start date has passed.
 * Rates are versioned rather than edited, so history stays intact.
 */
export async function getActiveRate(
  lotId: string,
  at: Date = new Date(),
): Promise<Rate | null> {
  const snap = await adminDb
    .collection(paths.rates(lotId))
    .where("effectiveFrom", "<=", Timestamp.fromDate(at))
    .orderBy("effectiveFrom", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  return toRate(snap.docs[0].id, snap.docs[0].data());
}

export async function listRates(lotId: string): Promise<Rate[]> {
  const snap = await adminDb
    .collection(paths.rates(lotId))
    .orderBy("effectiveFrom", "desc")
    .get();
  return snap.docs.map((d) => toRate(d.id, d.data()));
}

export async function listSlots(lotId: string): Promise<Slot[]> {
  const snap = await adminDb
    .collection(paths.slots(lotId))
    .orderBy("sortOrder")
    .get();
  return snap.docs.map((d) => toSlot(d.id, d.data()));
}

export async function listAvailableSlots(
  lotId: string,
  vehicleType: VehicleType,
): Promise<Slot[]> {
  const snap = await adminDb
    .collection(paths.slots(lotId))
    .where("vehicleType", "==", vehicleType)
    .where("status", "==", "available")
    .orderBy("sortOrder")
    .get();
  return snap.docs.map((d) => toSlot(d.id, d.data()));
}

/**
 * Every vehicle currently in the lot.
 *
 * Bounded by the number of slots, so loading the whole set is cheap — which is
 * what makes the "search any part of the plate" behaviour in §8 a simple
 * in-memory filter rather than a search index.
 */
export async function listActiveSessions(
  lotId: string,
): Promise<ParkingSession[]> {
  const snap = await adminDb
    .collection(paths.sessions(lotId))
    .where("status", "in", ["assigned", "parked"])
    .get();

  return snap.docs
    .map((d) => toSession(d.id, d.data()))
    .sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime());
}

export async function getSession(
  lotId: string,
  sessionId: string,
): Promise<ParkingSession | null> {
  const snap = await adminDb.doc(paths.session(lotId, sessionId)).get();
  if (!snap.exists) return null;
  return toSession(snap.id, snap.data()!);
}

/** §8 — vehicles parked longer than this are flagged for the owner to act on. */
export const LONG_STAY_HOURS = 24;

/** §8 — "cars parked beyond a set limit are flagged for you to act on". */
export const ABANDONED_AFTER_HOURS = 72;

/**
 * Splits the vehicles currently in the lot into the groups the consoles care
 * about. Lives here rather than in a page so the "what counts as a long stay"
 * rule has one definition, and so reading the clock happens outside a component.
 */
export function partitionActiveSessions(
  sessions: ParkingSession[],
  now: Date = new Date(),
): {
  parked: ParkingSession[];
  awaiting: ParkingSession[];
  longStays: ParkingSession[];
  abandoned: ParkingSession[];
} {
  const parked = sessions.filter((s) => s.status === "parked");
  const awaiting = sessions.filter((s) => s.status === "assigned");

  const olderThan = (hours: number) => (s: ParkingSession) =>
    now.getTime() - s.entryAt.getTime() > hours * 3_600_000;

  return {
    parked,
    awaiting,
    longStays: parked.filter(olderThan(LONG_STAY_HOURS)),
    abandoned: parked.filter(olderThan(ABANDONED_AFTER_HOURS)),
  };
}

/** Partial-plate search over the vehicles currently in the lot (§8). */
export function matchPlate(
  sessions: ParkingSession[],
  query: string,
): ParkingSession[] {
  const needle = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!needle) return [];
  return sessions.filter((s) => s.plate.normalized.includes(needle));
}

export async function listCompletedSessions(
  lotId: string,
  options: { from?: Date; to?: Date; limit?: number } = {},
): Promise<ParkingSession[]> {
  let query = adminDb
    .collection(paths.sessions(lotId))
    .where("status", "==", "completed")
    .orderBy("exitAt", "desc");

  if (options.from) {
    query = query.where("exitAt", ">=", Timestamp.fromDate(options.from));
  }
  if (options.to) {
    query = query.where("exitAt", "<=", Timestamp.fromDate(options.to));
  }

  const snap = await query.limit(options.limit ?? 200).get();
  return snap.docs.map((d) => toSession(d.id, d.data()));
}

/**
 * What one attendant has taken in since `since` — §8's shift handover, where
 * this total is checked against the cash actually in the drawer.
 */
export async function listShiftSessions(
  lotId: string,
  attendantUid: string,
  since: Date,
): Promise<ParkingSession[]> {
  const snap = await adminDb
    .collection(paths.sessions(lotId))
    .where("attendantOutUid", "==", attendantUid)
    .where("exitAt", ">=", Timestamp.fromDate(since))
    .orderBy("exitAt", "desc")
    .get();

  return snap.docs.map((d) => toSession(d.id, d.data()));
}

export async function countTurnaways(
  lotId: string,
  since: Date,
): Promise<number> {
  const snap = await adminDb
    .collection(paths.turnaways(lotId))
    .where("at", ">=", Timestamp.fromDate(since))
    .count()
    .get();
  return snap.data().count;
}

export interface AuditEntry {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  target: string;
  details: Record<string, string | number | boolean | null>;
  at: Date;
}

/** §7 — who changed what, and when. */
export async function listAuditLog(
  lotId: string,
  limit = 200,
): Promise<AuditEntry[]> {
  const snap = await adminDb
    .collection(paths.auditLog(lotId))
    .orderBy("at", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({
    id: d.id,
    actorUid: d.get("actorUid") ?? "",
    actorName: d.get("actorName") ?? "",
    actorRole: d.get("actorRole") ?? "",
    action: d.get("action") ?? "",
    target: d.get("target") ?? "",
    details: d.get("details") ?? {},
    at: toDate(d.get("at")) ?? new Date(0),
  }));
}

export async function listUsers(): Promise<UserRecord[]> {
  const snap = await adminDb.collection(paths.users()).get();
  return snap.docs
    .map((d) => toUserRecord(d.id, d.data()))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
