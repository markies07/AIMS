import type { Plate } from "./types";

export { formatDuration, formatTimeInZone, formatDateTimeInZone } from "./time";
export { formatAed, formatAmount } from "./money";

export function formatPlateOrDash(plate: Plate | null | undefined): string {
  if (!plate) return "—";
  const parts = [plate.emirate, plate.code, plate.number].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}
