import type { Fils } from "../money";
import type { FeeBreakdown, FeeLine, VatConfig, VehicleRate } from "../types";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;

export interface ComputeFeeInput {
  entryAt: Date;
  exitAt: Date;
  rate: VehicleRate;
  vat: VatConfig;
  /** §8 — an owner-approved goodwill reduction, applied before VAT. */
  discountFils?: Fils;
}

/**
 * Computes what a driver owes, per concept doc §6.
 *
 * Pure and Firebase-free on purpose: this is the single most consequential
 * function in the system, it will be argued with at the exit gate, and it must
 * be testable in isolation.
 *
 * The rules:
 *   - A stay at or under the grace period is free.
 *   - Otherwise time is rounded UP to the next whole hour (standard practice).
 *   - The first hour costs `firstHourFils`, every hour after costs
 *     `subsequentHourFils`.
 *   - The daily maximum is applied per rolling 24-hour window measured from
 *     entry, and the capped windows are summed. So a three-day stay is capped
 *     three times, not once.
 *
 * ASSUMPTION, flagged for the owner: the "first hour" premium is treated as an
 * entry charge levied once per stay, not once per day. A multi-day stay pays it
 * on day one only. This has not been confirmed and changes long-stay bills.
 */
export function computeFee(input: ComputeFeeInput): FeeBreakdown {
  const { entryAt, exitAt, rate, vat } = input;

  const elapsedMs = exitAt.getTime() - entryAt.getTime();
  if (!Number.isFinite(elapsedMs)) {
    throw new Error("computeFee: entryAt/exitAt must be valid dates");
  }
  if (elapsedMs < 0) {
    throw new Error("computeFee: exitAt is before entryAt");
  }

  const durationMinutes = Math.floor(elapsedMs / MS_PER_MINUTE);

  // --- Grace period -------------------------------------------------
  if (elapsedMs <= rate.graceMinutes * MS_PER_MINUTE) {
    return applyVat({
      durationMinutes,
      billedHours: 0,
      lines: [
        {
          kind: "grace",
          label: `Free grace period (first ${rate.graceMinutes} minutes)`,
          quantity: 1,
          unitFils: 0,
          amountFils: 0,
          dayIndex: 0,
        },
      ],
      grossFils: 0,
      capApplied: false,
      withinGrace: true,
      vat,
      discountFils: 0,
    });
  }

  // --- Round up to the next whole hour ------------------------------
  const billedHours = Math.ceil(elapsedMs / MS_PER_HOUR);

  // --- Charge, windowed into rolling 24h days -----------------------
  const lines: FeeLine[] = [];
  let grossFils = 0;
  let capApplied = false;

  const dayCount = Math.ceil(billedHours / HOURS_PER_DAY);

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const hoursThisDay = Math.min(
      HOURS_PER_DAY,
      billedHours - dayIndex * HOURS_PER_DAY,
    );
    const dayLines: FeeLine[] = [];
    let dayTotal = 0;

    // The first-hour premium applies once, at the very start of the stay.
    if (dayIndex === 0) {
      dayLines.push({
        kind: "first_hour",
        label: "First hour",
        quantity: 1,
        unitFils: rate.firstHourFils,
        amountFils: rate.firstHourFils,
        dayIndex,
      });
      dayTotal += rate.firstHourFils;
    }

    const additionalHours = dayIndex === 0 ? hoursThisDay - 1 : hoursThisDay;
    if (additionalHours > 0) {
      const amount = additionalHours * rate.subsequentHourFils;
      dayLines.push({
        kind: "additional_hours",
        label:
          dayIndex === 0
            ? `${additionalHours} additional hour${additionalHours === 1 ? "" : "s"}`
            : `Day ${dayIndex + 1} — ${additionalHours} hour${additionalHours === 1 ? "" : "s"}`,
        quantity: additionalHours,
        unitFils: rate.subsequentHourFils,
        amountFils: amount,
        dayIndex,
      });
      dayTotal += amount;
    }

    // Cap this window, and show the reduction rather than silently shrinking
    // the numbers above it — the driver needs to see why the total is lower.
    if (rate.dailyMaxFils !== null && dayTotal > rate.dailyMaxFils) {
      const adjustment = rate.dailyMaxFils - dayTotal;
      dayLines.push({
        kind: "daily_cap",
        label:
          dayCount === 1
            ? "Daily maximum applied"
            : `Day ${dayIndex + 1} — daily maximum applied`,
        quantity: 1,
        unitFils: adjustment,
        amountFils: adjustment,
        dayIndex,
      });
      dayTotal = rate.dailyMaxFils;
      capApplied = true;
    }

    lines.push(...dayLines);
    grossFils += dayTotal;
  }

  return applyVat({
    durationMinutes,
    billedHours,
    lines,
    grossFils,
    capApplied,
    withinGrace: false,
    vat,
    discountFils: input.discountFils ?? 0,
  });
}

interface ApplyVatInput {
  durationMinutes: number;
  billedHours: number;
  lines: FeeLine[];
  grossFils: Fils;
  capApplied: boolean;
  withinGrace: boolean;
  vat: VatConfig;
  discountFils: Fils;
}

/**
 * §9 — whether posted prices already include VAT changes how the receipt must
 * be printed, so both readings are supported and the split is always reported.
 *
 *   inclusive: the computed charge IS the total; VAT is extracted from it.
 *   exclusive: the computed charge is net; VAT is added on top.
 */
function applyVat(input: ApplyVatInput): FeeBreakdown {
  const {
    durationMinutes,
    billedHours,
    lines,
    capApplied,
    withinGrace,
    vat,
    discountFils,
  } = input;

  const charge = Math.max(0, input.grossFils - Math.max(0, discountFils));

  if (!vat.registered || charge === 0) {
    return {
      durationMinutes,
      billedHours,
      lines,
      netFils: charge,
      vatFils: 0,
      totalFils: charge,
      capApplied,
      withinGrace,
    };
  }

  const multiplier = vat.ratePercent / 100;

  if (vat.pricesIncludeVat) {
    const netFils = Math.round(charge / (1 + multiplier));
    return {
      durationMinutes,
      billedHours,
      lines,
      netFils,
      vatFils: charge - netFils,
      totalFils: charge,
      capApplied,
      withinGrace,
    };
  }

  const vatFils = Math.round(charge * multiplier);
  return {
    durationMinutes,
    billedHours,
    lines,
    netFils: charge,
    vatFils,
    totalFils: charge + vatFils,
    capApplied,
    withinGrace,
  };
}

/** Live "owes so far" for a car still parked — §5 Step 4. */
export function computeRunningFee(
  entryAt: Date,
  now: Date,
  rate: VehicleRate,
  vat: VatConfig,
): FeeBreakdown {
  return computeFee({ entryAt, exitAt: now, rate, vat });
}
