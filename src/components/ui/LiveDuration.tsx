"use client";

import { formatDuration } from "@/lib/time";
import { minutesSince, useNow } from "@/lib/useNow";

/**
 * How long a vehicle has been in the lot, ticking as it goes.
 *
 * Rendered client-side from a timestamp rather than computed on the server:
 * a server-computed duration is frozen at render time, and an attendant
 * looking at a screen for ten minutes would be reading a stale figure while
 * quoting it to a driver.
 */
export function LiveDuration({
  sinceMs,
  suffix,
  fallback = "—",
}: {
  sinceMs: number;
  suffix?: string;
  fallback?: string;
}) {
  const now = useNow();
  const minutes = minutesSince(now, sinceMs);

  return (
    <span className="tabular-nums">
      {minutes === null ? fallback : formatDuration(minutes)}
      {minutes !== null && suffix ? suffix : ""}
    </span>
  );
}
