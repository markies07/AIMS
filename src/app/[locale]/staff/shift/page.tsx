import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getLotProfile, listShiftSessions } from "@/lib/data/lot";
import { formatAed } from "@/lib/money";
import { formatTimeInZone, startOfDayInZone } from "@/lib/time";
import { formatPlateOrDash } from "@/lib/format";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";

export const dynamic = "force-dynamic";

/** §8 — the shift handover total, to be checked against the cash drawer. */
export default async function ShiftPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect("/admin");

  const t = await getTranslations("staff");
  const lot = await getLotProfile(DEFAULT_LOT_ID);
  const timeZone = lot?.timeZone ?? "Asia/Dubai";

  const since = startOfDayInZone(new Date(), timeZone);
  const sessions = await listShiftSessions(DEFAULT_LOT_ID, user.uid, since);

  const collected = sessions.reduce(
    (sum, s) => sum + (s.fee?.totalFils ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t("shiftVehicles")} value={sessions.length} />
        <Stat
          label={t("shiftCash")}
          value={formatAed(collected)}
          tone="accent"
        />
      </div>

      <Card>
        <SectionHeader
          title={t("shiftTitle")}
          hint={t("shiftSince", { time: formatTimeInZone(since, timeZone) })}
        />

        {sessions.length === 0 ? (
          <p className="text-faint py-6 text-center text-sm">
            Nothing processed yet today.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="border-border/60 flex items-center gap-3 border-b py-2 text-sm last:border-0"
              >
                <span className="text-faint w-12 shrink-0 tabular-nums">
                  {session.exitAt
                    ? formatTimeInZone(session.exitAt, timeZone)
                    : "—"}
                </span>
                <span className="text-text min-w-0 flex-1 truncate font-medium">
                  {formatPlateOrDash(session.plate)}
                </span>
                <span className="text-faint shrink-0">{session.slotCode}</span>
                <span className="text-text shrink-0 font-semibold tabular-nums">
                  {formatAed(session.fee?.totalFils ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-faint mt-4 text-xs">{t("shiftHandover")}</p>
      </Card>
    </div>
  );
}
