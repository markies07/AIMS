import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Car,
  CircleParking,
  LogIn,
  LogOut,
  Map,
  Search,
} from "lucide-react";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getCurrentUser } from "@/lib/auth/session";
import {
  LONG_STAY_HOURS,
  getLotProfile,
  getPublicView,
  listActiveSessions,
  listShiftSessions,
  partitionActiveSessions,
} from "@/lib/data/lot";
import { formatAed } from "@/lib/money";
import { formatTimeInZone, startOfDayInZone } from "@/lib/time";
import { Link } from "@/i18n/navigation";
import { Card, PageHeader, SectionHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { StatusPill, PlateBadge } from "@/components/ui/StatusPill";
import { LiveDuration } from "@/components/ui/LiveDuration";

export const dynamic = "force-dynamic";

export default async function StaffDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect("/admin");

  const t = await getTranslations("staff");
  const tc = await getTranslations("common");

  const lot = await getLotProfile(DEFAULT_LOT_ID);
  const timeZone = lot?.timeZone ?? "Asia/Dubai";
  const since = startOfDayInZone(new Date(), timeZone);

  const [view, sessions, shift] = await Promise.all([
    getPublicView(DEFAULT_LOT_ID),
    listActiveSessions(DEFAULT_LOT_ID),
    listShiftSessions(DEFAULT_LOT_ID, user.uid, since).catch(() => []),
  ]);

  const { parked, awaiting, longStays } = partitionActiveSessions(sessions);
  const counts = view?.statusCounts;
  const collected = shift.reduce((sum, s) => sum + (s.fee?.totalFils ?? 0), 0);

  const recent = [...sessions]
    .sort((a, b) => b.entryAt.getTime() - a.entryAt.getTime())
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title={t("greeting", {
          name: firstName(user.displayName || user.email),
        })}
        subtitle={t("entryStation")}
      />

      {/* ---- Figures --------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("freeNow")}
          value={counts?.available ?? 0}
          hint={`of ${counts?.total ?? 0}`}
          tone={counts?.available === 0 ? "occupied" : "accent"}
          icon={<CircleParking className="size-4" />}
        />
        <Stat
          label={t("parkedNow")}
          value={parked.length}
          icon={<Car className="size-4" />}
        />
        <Stat
          label={t("enteredToday")}
          value={shift.length + parked.length}
          icon={<LogIn className="size-4" />}
        />
        <Stat
          label={t("myCollection")}
          value={formatAed(collected)}
          icon={<Banknote className="size-4" />}
        />
      </div>

      {/* ---- The four things an attendant actually does ---------------- */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ActionTile
          href="/staff/in"
          icon={<LogIn className="size-6" />}
          label={t("vehicleIn")}
          hint="Record entry & assign a slot"
          variant="accent"
        />
        <ActionTile
          href="/staff/out"
          icon={<LogOut className="size-6" />}
          label={t("vehicleOut")}
          hint="Process exit & payment"
          variant="ink"
        />
        <ActionTile
          href="/staff/out"
          icon={<Search className="size-6" />}
          label={tc("search")}
          hint="Find a plate or slot"
          variant="plain"
        />
        <ActionTile
          href="/staff/map"
          icon={<Map className="size-6" />}
          label={t("lotMap")}
          hint="Live zone status"
          variant="plain"
        />
      </div>

      {/* ---- Things needing attention ---------------------------------- */}
      {(awaiting.length > 0 || longStays.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {awaiting.length > 0 && (
            <Card>
              <SectionHeader
                title={t("awaitingParking")}
                hint={t("confirmParkedHint")}
              />
              <ul className="flex flex-col gap-2">
                {awaiting.map((session) => (
                  <li
                    key={session.id}
                    className="border-border rounded-control flex items-center justify-between gap-3 border p-2.5"
                  >
                    <PlateBadge {...session.plate} />
                    <span className="text-faint ms-auto text-xs">
                      <LiveDuration sinceMs={session.entryAt.getTime()} />
                    </span>
                    <StatusPill tone="vip">{session.slotCode}</StatusPill>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {longStays.length > 0 && (
            <Card>
              <SectionHeader
                title={t("longStays")}
                hint={`Parked longer than ${LONG_STAY_HOURS} hours.`}
              />
              <ul className="flex flex-col gap-2">
                {longStays.map((session) => (
                  <li
                    key={session.id}
                    className="bg-vip-surface rounded-control flex items-center gap-2.5 p-2.5 text-sm"
                  >
                    <AlertTriangle className="text-vip size-4 shrink-0" />
                    <PlateBadge {...session.plate} />
                    <span className="text-muted ms-auto text-xs">
                      <LiveDuration sinceMs={session.entryAt.getTime()} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ---- Recent activity ------------------------------------------- */}
      <Card className="mt-4">
        <SectionHeader
          title={t("recentActivity")}
          action={
            <Link
              href="/staff/map"
              className="text-muted hover:text-text inline-flex items-center gap-1 text-sm font-medium"
            >
              {t("viewAll")}
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />

        {recent.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">
            {t("noActivity")}
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-lg border-collapse text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="stat-label py-2 ps-1 text-start">
                    {tc("plate")}
                  </th>
                  <th className="stat-label py-2 text-start">{tc("slot")}</th>
                  <th className="stat-label py-2 text-start">{t("timeIn")}</th>
                  <th className="stat-label py-2 pe-1 text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((session) => (
                  <tr key={session.id} className="border-border/60 border-b">
                    <td className="py-2.5 ps-1">
                      <PlateBadge {...session.plate} />
                    </td>
                    <td className="text-text py-2.5 font-medium">
                      {session.slotCode}
                    </td>
                    <td className="text-muted py-2.5 tabular-nums">
                      {formatTimeInZone(session.entryAt, timeZone)}
                    </td>
                    <td className="py-2.5 pe-1 text-end">
                      {session.status === "parked" ? (
                        <StatusPill tone="occupied">{tc("taken")}</StatusPill>
                      ) : (
                        <StatusPill tone="vip">{t("assigned")}</StatusPill>
                      )}
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

function firstName(value: string): string {
  return value.split(/[\s@]/)[0] || value;
}

function ActionTile({
  href,
  icon,
  label,
  hint,
  variant,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  variant: "accent" | "ink" | "plain";
}) {
  return (
    <Link
      href={href}
      className={
        variant === "accent"
          ? "bg-accent text-accent-text rounded-card flex min-h-32 flex-col justify-between p-4 transition hover:brightness-105"
          : variant === "ink"
            ? "bg-ink text-ink-text rounded-card flex min-h-32 flex-col justify-between p-4 transition hover:brightness-125"
            : "bg-surface border-border text-text rounded-card hover:border-border-strong flex min-h-32 flex-col justify-between border p-4 transition"
      }
    >
      <span
        className={
          variant === "plain"
            ? "bg-surface-2 flex size-11 items-center justify-center rounded-full"
            : "flex size-11 items-center justify-center rounded-full bg-white/15"
        }
      >
        {icon}
      </span>
      <span>
        <span className="block text-base font-bold">{label}</span>
        <span
          className={
            variant === "plain"
              ? "text-muted block text-xs"
              : "block text-xs opacity-75"
          }
        >
          {hint}
        </span>
      </span>
    </Link>
  );
}
