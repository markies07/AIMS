"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { HOUR_NOT_RECORDED } from "@/lib/data/publicView";

/**
 * The mockup's "pick available timeslot" row, rendered as what it honestly is:
 * how busy the lot has been today, hour by hour.
 *
 * It is deliberately NOT interactive. The concept doc's public side is view-only
 * (§1, §3) and advance booking is a later addition (§11) — so these chips must
 * not look tappable, or a driver will believe they have reserved a space and
 * arrive expecting one.
 */
export function OccupancyRow({ hourly }: { hourly: number[] }) {
  const t = useTranslations("public");

  const recorded = hourly
    .map((value, hour) => ({ value, hour }))
    .filter((h) => h.value !== HOUR_NOT_RECORDED);

  if (recorded.length === 0) {
    return (
      <p className="text-faint py-2 text-sm">{t("todaysOccupancyHint")}</p>
    );
  }

  const firstHour = recorded[0].hour;
  const lastHour = recorded[recorded.length - 1].hour;
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, i) => firstHour + i,
  );

  return (
    <div>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="list">
        {hours.map((hour) => {
          const value = hourly[hour];
          const known = value !== HOUR_NOT_RECORDED;
          return (
            <li
              key={hour}
              className={cn(
                "rounded-control border px-2 py-2 text-center",
                known
                  ? "border-border bg-surface-2"
                  : "border-border/50 bg-surface text-faint",
              )}
            >
              <span className="text-text block text-sm font-medium tabular-nums">
                {String(hour).padStart(2, "0")}:00
              </span>
              {known && (
                <>
                  <span
                    className="bg-surface-3 mt-1.5 block h-1 overflow-hidden rounded-full"
                    aria-hidden="true"
                  >
                    <span
                      className="bg-accent block h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                    />
                  </span>
                  <span className="text-muted mt-1 block text-[0.6875rem] tabular-nums">
                    {value}%
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-faint mt-3 flex items-center gap-1.5 text-xs">
        <span className="bg-surface-3 inline-block h-1 w-6 rounded-full" />
        {t("quiet")}
        <span className="bg-accent ms-2 inline-block h-1 w-6 rounded-full" />
        {t("busy")}
      </p>
    </div>
  );
}
