"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useTranslations } from "next-intl";
import {
  Building2,
  Car,
  CircleParking,
  Navigation,
  RefreshCw,
  Wrench,
} from "lucide-react";

import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/firebase/paths";
import { cn } from "@/lib/cn";
import { minutesSince, useNow } from "@/lib/useNow";
import { levelsOf, zonesOf } from "@/lib/data/publicView";
import { dtoFromRaw, type PublicViewDTO } from "@/lib/data/publicViewDto";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { LotAisle, SlotLegend } from "@/components/ui/ParkingSpace";
import { SlotTile } from "./SlotTile";
import { OccupancyRow } from "./OccupancyRow";

/**
 * The driver-facing screen (§5 Step 1).
 *
 * Rendered on the server first so the free count is visible immediately — a
 * driver deciding whether to set off should not wait on a websocket — then
 * subscribed to `onSnapshot` so it stays true as staff work the gate
 * (§5 Step 6).
 */
export function AvailabilityBoard({
  initial,
  lotId,
  mapsUrl,
}: {
  initial: PublicViewDTO;
  lotId: string;
  mapsUrl: string | null;
}) {
  const t = useTranslations("public");
  const tc = useTranslations("common");

  const [view, setView] = useState(initial);
  const [levelIndex, setLevelIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, paths.publicView(lotId)),
      (snapshot) => {
        const next = dtoFromRaw(lotId, snapshot.data());
        if (next) setView(next);
      },
      // A dropped subscription must not blank the page — the server-rendered
      // figures stay on screen rather than showing an error to a driver.
      (error) => console.error("[availability] subscription failed", error),
    );
    return unsubscribe;
  }, [lotId]);

  const levels = useMemo(() => levelsOf(view.slots), [view.slots]);
  const activeLevel = levels[Math.min(levelIndex, levels.length - 1)] ?? "";
  const zones = useMemo(
    () => zonesOf(view.slots, activeLevel),
    [view.slots, activeLevel],
  );

  const counts = view.statusCounts;
  const totalFree = view.freeByType.car + view.freeByType.motorcycle;

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="border-border bg-surface rounded-card relative overflow-hidden border">
        {/*
          A CSS gradient rather than a stock photograph: the mockup's hero image
          is of a building that is not this lot, and shipping a misleading photo
          of someone else's facility is worse than an honest abstract ground.
        */}
        <div
          aria-hidden="true"
          className="from-ink via-ink absolute inset-0 bg-linear-to-br to-[#123c2c]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 22px)",
          }}
        />

        <div className="relative p-6 sm:p-10">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
              totalFree > 0
                ? "bg-accent text-accent-text"
                : "bg-occupied-surface text-occupied",
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {totalFree > 0 ? t("parkingAvailable") : t("lotFull")}
          </span>

          <h1 className="mt-4 max-w-lg text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {view.lotName}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/70">
            {t("heroSubtitle")}
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div className="rounded-card bg-white/10 px-5 py-4 backdrop-blur">
              <p className="stat-label text-white/60">{t("availableNow")}</p>
              <p className="display-figure text-accent-strong mt-1 text-5xl">
                {totalFree}
              </p>
            </div>

            {/*
              The mockup's hero CTA is "Reserve Your Space". This build is
              browse-only by decision, so the button does the thing a driver
              checking availability actually wants next — navigate here — rather
              than promising a reservation the system cannot honour.
            */}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-control text-ink inline-flex min-h-12 items-center gap-2 bg-white px-5 font-semibold transition hover:bg-white/90"
              >
                <Navigation className="size-4" />
                {t("getDirections")}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---- Real-time capacity -------------------------------------- */}
      <section>
        <SectionHeader
          title={t("realTimeCapacity")}
          action={<LiveBadge updatedAtMs={view.updatedAtMs} />}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label={t("totalCapacity")}
            value={counts.total}
            icon={<Building2 className="size-4" />}
          />
          <Stat
            label={tc("free")}
            value={counts.available}
            tone="accent"
            icon={<CircleParking className="size-4" />}
          />
          <Stat
            label={tc("taken")}
            value={counts.occupied}
            tone="occupied"
            icon={<Car className="size-4" />}
          />
          <Stat
            label={t("reserved")}
            value={counts.assigned}
            tone="vip"
            hint={t("reservedHint")}
          />
          <Stat
            label={tc("outOfService")}
            value={counts.outOfService}
            tone="muted"
            icon={<Wrench className="size-4" />}
          />
        </div>
      </section>

      {/* ---- Facility layout ----------------------------------------- */}
      <section>
        <SectionHeader
          title={t("facilityLayout")}
          hint={t("parkingSpotsHint")}
          action={
            levels.length > 1 ? (
              <div className="border-border bg-surface-2 flex items-center gap-1 rounded-full border p-1">
                {levels.map((level, index) => (
                  <button
                    key={level}
                    onClick={() => setLevelIndex(index)}
                    aria-pressed={index === levelIndex}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      index === levelIndex
                        ? "bg-surface text-text shadow-sm"
                        : "text-muted hover:text-text",
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            ) : null
          }
        />

        <Card>
          {zones.length === 0 ? (
            <p className="text-muted py-8 text-center text-sm">
              {t("noSlotsOfType")}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {zones.map((zone) => {
                const zoneSlots = view.slots.filter(
                  (s) => s.level === activeLevel && (s.zone || "") === zone,
                );
                const zoneFree = zoneSlots.filter(
                  (s) => s.status === "available",
                ).length;

                return (
                  <div key={zone || "unzoned"}>
                    <div className="mb-2.5 flex items-baseline justify-between gap-3">
                      <h3 className="text-text text-sm font-semibold">
                        {zone || activeLevel}
                      </h3>
                      <span className="text-muted text-xs tabular-nums">
                        {zoneFree} / {zoneSlots.length}{" "}
                        {tc("free").toLowerCase()}
                      </span>
                    </div>
                    {/*
                      No gap between cells: each bay paints the line down its
                      own inline-end edge, so neighbours share one line the way
                      they do on real tarmac.
                    */}
                    <div className="rounded-tile overflow-hidden border border-black/15 shadow-sm">
                      <div
                        role="list"
                        aria-label={zone || activeLevel}
                        className="lot-asphalt grid grid-cols-4 border-t-2 border-white/55 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12"
                      >
                        {zoneSlots.map((slot) => (
                          <SlotTile key={slot.code} slot={slot} />
                        ))}
                      </div>
                      <LotAisle />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-border mt-5 border-t pt-4">
            <SlotLegend
              labels={{
                free: tc("free"),
                taken: tc("taken"),
                reserved: t("reserved"),
                outOfService: tc("outOfService"),
              }}
            />
          </div>
        </Card>
      </section>

      {/* ---- Occupancy by hour --------------------------------------- */}
      <section>
        <SectionHeader
          title={t("todaysOccupancy")}
          hint={t("todaysOccupancyHint")}
          action={
            <span className="border-border text-muted rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium">
              {t("notBookable")}
            </span>
          }
        />
        <Card>
          <OccupancyRow hourly={view.hourlyOccupancy} />
        </Card>
      </section>
    </div>
  );
}

function LiveBadge({ updatedAtMs }: { updatedAtMs: number }) {
  const t = useTranslations("public");

  // Ticks every half minute so "updated 2 minutes ago" does not go stale while
  // a driver keeps the page open on the way over. Null until mounted, so the
  // server and first client render agree.
  const ageMinutes = minutesSince(useNow(), updatedAtMs);

  return (
    <span className="text-muted flex items-center gap-1.5 text-xs font-medium">
      <RefreshCw className="text-accent size-3" />
      {ageMinutes === null || ageMinutes < 1
        ? t("updatedJustNow")
        : t("updatedAt", { time: `${ageMinutes}m ago` })}
    </span>
  );
}
