import { getTranslations, setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile, listCompletedSessions } from "@/lib/data/lot";
import { formatAed } from "@/lib/money";
import { formatDateTimeInZone, formatDuration } from "@/lib/time";
import { formatPlateOrDash } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

/** §7 — every completed parking session, searchable. */
export default async function OwnerHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("owner");
  const ts = await getTranslations("staff");
  const tc = await getTranslations("common");

  const lot = await getLotProfile(DEFAULT_LOT_ID);
  const timeZone = lot?.timeZone ?? "Asia/Dubai";

  const sessions = await listCompletedSessions(DEFAULT_LOT_ID, { limit: 300 });

  const needle = (q ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filtered = needle
    ? sessions.filter(
        (s) =>
          s.plate.normalized.includes(needle) ||
          (s.receiptNo ?? "").toLowerCase().includes(needle),
      )
    : sessions;

  const total = filtered.reduce((sum, s) => sum + (s.fee?.totalFils ?? 0), 0);

  return (
    <Card>
      <SectionHeader
        title={t("history")}
        hint={`${filtered.length} sessions · ${formatAed(total)}`}
      />

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={`${tc("search")} plate or receipt no.`}
          className="bg-surface-2 border-border text-text placeholder:text-faint rounded-control min-h-11 w-full border px-3 text-sm focus:outline-none"
        />
      </form>

      {filtered.length === 0 ? (
        <p className="text-faint py-8 text-center text-sm">{t("noResults")}</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-border text-muted border-b text-start">
                <th className="py-2 ps-1 text-start font-medium">
                  {ts("timeOut")}
                </th>
                <th className="py-2 text-start font-medium">{tc("plate")}</th>
                <th className="py-2 text-start font-medium">{tc("slot")}</th>
                <th className="py-2 text-start font-medium">
                  {ts("duration")}
                </th>
                <th className="py-2 text-end font-medium">{tc("total")}</th>
                <th className="py-2 pe-1 text-end font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => (
                <tr key={session.id} className="border-border/60 border-b">
                  <td className="text-muted py-2.5 ps-1 whitespace-nowrap tabular-nums">
                    {session.exitAt
                      ? formatDateTimeInZone(session.exitAt, timeZone)
                      : "—"}
                  </td>
                  <td className="text-text py-2.5 font-medium">
                    {formatPlateOrDash(session.plate)}
                  </td>
                  <td className="text-muted py-2.5">{session.slotCode}</td>
                  <td className="text-muted py-2.5 tabular-nums">
                    {formatDuration(session.fee?.durationMinutes ?? 0)}
                  </td>
                  <td className="text-text py-2.5 text-end font-semibold tabular-nums">
                    {formatAed(session.fee?.totalFils ?? 0)}
                  </td>
                  <td className="py-2.5 pe-1 text-end">
                    <Link
                      href={`/receipt/${session.id}`}
                      target="_blank"
                      className="text-muted hover:text-text text-xs font-medium"
                    >
                      {session.receiptNo}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
