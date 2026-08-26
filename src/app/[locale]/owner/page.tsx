import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Banknote,
  CircleParking,
  Info,
  Timer,
} from "lucide-react";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import {
  LONG_STAY_HOURS,
  countTurnaways,
  getLotProfile,
  getPublicView,
  listActiveSessions,
  listCompletedSessions,
  partitionActiveSessions,
} from "@/lib/data/lot";
import { formatAed } from "@/lib/money";
import { formatDuration, startOfDayInZone } from "@/lib/time";
import { formatPlateOrDash } from "@/lib/format";
import { HOUR_NOT_RECORDED } from "@/lib/data/publicView";
import { Link } from "@/i18n/navigation";
import { Card, PageHeader, SectionHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { PlateBadge, StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

/** §7 — today's income, how full the lot is, busiest hours. */
export default async function OwnerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner");
  const tc = await getTranslations("common");

  const lot = await getLotProfile(DEFAULT_LOT_ID);
  const timeZone = lot?.timeZone ?? "Asia/Dubai";
  const since = startOfDayInZone(new Date(), timeZone);

  const [view, completed, active, turnaways] = await Promise.all([
    getPublicView(DEFAULT_LOT_ID),
    listCompletedSessions(DEFAULT_LOT_ID, { from: since, limit: 500 }),
    listActiveSessions(DEFAULT_LOT_ID),
    countTurnaways(DEFAULT_LOT_ID, since).catch(() => 0),
  ]);

  const income = completed.reduce((sum, s) => sum + (s.fee?.totalFils ?? 0), 0);
  const counts = view?.statusCounts;

  const occupancy =
    !counts || counts.total === 0
      ? 0
      : Math.round(((counts.total - counts.available) / counts.total) * 100);

  const avgMinutes =
    completed.length === 0
      ? 0
      : Math.round(
          completed.reduce((sum, s) => sum + (s.fee?.durationMinutes ?? 0), 0) /
            completed.length,
        );

  const { longStays } = partitionActiveSessions(active);
  const hourly = view?.hourlyOccupancy ?? [];

  return (
    <>
      <PageHeader title={t("overview")} subtitle={t("overviewSubtitle")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("todaysRevenue")}
          value={formatAed(income)}
          hint={`${completed.length} vehicles`}
          icon={<Banknote className="size-4" />}
        />
        <Stat
          label={t("occupancy")}
          value={`${occupancy}%`}
          hint={`${counts?.available ?? 0} of ${counts?.total ?? 0} free`}
          icon={<CircleParking className="size-4" />}
        />
        <Stat
          label={t("avgDuration")}
          value={avgMinutes === 0 ? "—" : formatDuration(avgMinutes)}
          icon={<Timer className="size-4" />}
        />
        <Stat
          label={t("turnedAway")}
          value={turnaways}
          tone={turnaways > 0 ? "occupied" : "neutral"}
          hint={turnaways > 0 ? "Lost business" : undefined}
          icon={<Ban className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <SectionHeader
            title={t("occupancyTrends")}
            hint="Recorded through today, in the lot's local time."
          />
          <OccupancyChart hourly={hourly} />
        </Card>

        <Card>
          <SectionHeader title={t("alerts")} />
          <AlertList
            counts={counts}
            longStays={longStays.map((s) => ({
              id: s.id,
              plate: formatPlateOrDash(s.plate),
              slot: s.slotCode,
            }))}
            labels={{
              none: t("noAlerts"),
              almostFull: t("alertAlmostFull"),
              almostFullBody: (free, total) =>
                t("alertAlmostFullBody", { free, total }),
              longStay: t("alertLongStay"),
              longStayBody: (plate, slot) =>
                t("alertLongStayBody", { plate, slot, hours: LONG_STAY_HOURS }),
              outOfService: t("alertOutOfService"),
              outOfServiceBody: (count) =>
                t("alertOutOfServiceBody", { count }),
            }}
          />
        </Card>
      </div>

      <Card className="mt-4">
        <SectionHeader
          title={t("recentTransactions")}
          action={
            <Link
              href="/owner/history"
              className="text-muted hover:text-text inline-flex items-center gap-1 text-sm font-medium"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />

        {completed.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">
            {t("noResults")}
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="stat-label py-2 ps-1 text-start">Receipt</th>
                  <th className="stat-label py-2 text-start">{tc("plate")}</th>
                  <th className="stat-label py-2 text-start">{tc("slot")}</th>
                  <th className="stat-label py-2 text-start">
                    {t("duration")}
                  </th>
                  <th className="stat-label py-2 text-end">{tc("amount")}</th>
                  <th className="stat-label py-2 pe-1 text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {completed.slice(0, 8).map((session) => (
                  <tr key={session.id} className="border-border/60 border-b">
                    <td className="text-muted py-2.5 ps-1 font-mono text-xs">
                      <Link
                        href={`/receipt/${session.id}`}
                        target="_blank"
                        className="hover:text-text"
                      >
                        {session.receiptNo}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <PlateBadge {...session.plate} />
                    </td>
                    <td className="text-muted py-2.5">{session.slotCode}</td>
                    <td className="text-muted py-2.5 tabular-nums">
                      {formatDuration(session.fee?.durationMinutes ?? 0)}
                    </td>
                    <td className="text-text py-2.5 text-end font-bold tabular-nums">
                      {formatAed(session.fee?.totalFils ?? 0)}
                    </td>
                    <td className="py-2.5 pe-1 text-end">
                      <StatusPill tone="free">Completed</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * Occupancy through the day. A plain CSS bar chart rather than a charting
 * library: it is twenty-four values, and shipping a charting bundle to render
 * them would cost more than the rest of the page put together.
 */
function OccupancyChart({ hourly }: { hourly: number[] }) {
  const recorded = hourly.filter((v) => v !== HOUR_NOT_RECORDED);
  if (recorded.length === 0) {
    return (
      <p className="text-muted py-10 text-center text-sm">No data yet today.</p>
    );
  }

  const peak = Math.max(...recorded);

  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {hourly.map((value, hour) => {
          const known = value !== HOUR_NOT_RECORDED;
          const isPeak = known && value === peak;
          return (
            <div
              key={hour}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div className="bg-surface-2 flex h-36 w-full items-end overflow-hidden rounded-sm">
                {known && (
                  <div
                    className={isPeak ? "bg-ink w-full" : "bg-surface-3 w-full"}
                    style={{ height: `${Math.max(3, value)}%` }}
                    title={`${String(hour).padStart(2, "0")}:00 — ${value}%`}
                  />
                )}
              </div>
              {hour % 3 === 0 && (
                <span className="text-faint text-[0.5625rem] tabular-nums">
                  {String(hour).padStart(2, "0")}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-muted mt-3 text-xs">
        Peak so far: <span className="text-text font-semibold">{peak}%</span>
      </p>
    </div>
  );
}

interface AlertLabels {
  none: string;
  almostFull: string;
  almostFullBody: (free: number, total: number) => string;
  longStay: string;
  longStayBody: (plate: string, slot: string) => string;
  outOfService: string;
  outOfServiceBody: (count: number) => string;
}

/**
 * Alerts are derived from live data rather than stored, so they cannot go stale
 * and never need dismissing — a condition that has resolved simply stops
 * appearing. A stored alert queue would need its own lifecycle and would
 * eventually lie.
 */
function AlertList({
  counts,
  longStays,
  labels,
}: {
  counts:
    { available: number; total: number; outOfService: number } | undefined;
  longStays: { id: string; plate: string; slot: string }[];
  labels: AlertLabels;
}) {
  const alerts: {
    key: string;
    tone: "warning" | "info";
    title: string;
    body: string;
  }[] = [];

  if (counts && counts.total > 0 && counts.available / counts.total <= 0.1) {
    alerts.push({
      key: "full",
      tone: "warning",
      title: labels.almostFull,
      body: labels.almostFullBody(counts.available, counts.total),
    });
  }

  for (const stay of longStays.slice(0, 3)) {
    alerts.push({
      key: `stay-${stay.id}`,
      tone: "warning",
      title: labels.longStay,
      body: labels.longStayBody(stay.plate, stay.slot),
    });
  }

  if (counts && counts.outOfService > 0) {
    alerts.push({
      key: "oos",
      tone: "info",
      title: labels.outOfService,
      body: labels.outOfServiceBody(counts.outOfService),
    });
  }

  if (alerts.length === 0) {
    return <p className="text-muted py-8 text-center text-sm">{labels.none}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {alerts.map((alert) => (
        <li
          key={alert.key}
          className={
            alert.tone === "warning"
              ? "bg-vip-surface rounded-control flex gap-2.5 p-3"
              : "bg-surface-2 rounded-control flex gap-2.5 p-3"
          }
        >
          {alert.tone === "warning" ? (
            <AlertTriangle className="text-vip mt-0.5 size-4 shrink-0" />
          ) : (
            <Info className="text-muted mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-text text-sm font-semibold">{alert.title}</p>
            <p className="text-muted mt-0.5 text-xs">{alert.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
