/**
 * All instants are stored in UTC and rendered in the lot's timezone (§9 — Gulf
 * Standard Time, UTC+4). Never store a wall-clock string; never trust a browser
 * clock for anything billable.
 */

export const LOT_TIMEZONE = "Asia/Dubai";

/** Hour of day (0–23) at `instant`, in the given timezone. */
export function hourInZone(instant: Date, timeZone = LOT_TIMEZONE): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(instant);
  return Number(hour) % 24;
}

/** Calendar date at `instant` in the given timezone, as "YYYY-MM-DD". */
export function dateKeyInZone(instant: Date, timeZone = LOT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The UTC instant at which the local day containing `instant` began. */
export function startOfDayInZone(instant: Date, timeZone = LOT_TIMEZONE): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsedMs =
    (get("hour") % 24) * 3_600_000 +
    get("minute") * 60_000 +
    get("second") * 1000;

  const start = new Date(instant.getTime() - elapsedMs);
  start.setUTCMilliseconds(0);
  return start;
}

export function formatTimeInZone(
  instant: Date,
  timeZone = LOT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

export function formatDateTimeInZone(
  instant: Date,
  timeZone = LOT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

/** "3h 20m", for durations shown to drivers and staff. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const days = Math.floor(safe / 1440);
  const hours = Math.floor((safe % 1440) / 60);
  const mins = safe % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}
