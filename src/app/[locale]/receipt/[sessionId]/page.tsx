import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getLotProfile, getSession } from "@/lib/data/lot";
import { adminAuth } from "@/lib/firebase/admin";
import { formatAed } from "@/lib/money";
import { formatDateTimeInZone, formatDuration } from "@/lib/time";
import { formatPlateOrDash } from "@/lib/format";
import { PrintButton } from "@/components/staff/PrintButton";

export const dynamic = "force-dynamic";

/**
 * §6 — the driver's receipt.
 *
 * A normal page with print styles rather than anything hardware-specific: it
 * prints from any attendant machine to any printer, with no driver to install
 * and nothing to break at 2am. Sized for 80mm thermal paper, the common
 * receipt-printer width.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect("/admin");

  // Being signed in is not enough. A receipt carries a plate number and a
  // payment record — personal data under §9 — so the caller must actually
  // belong to this lot. `notFound` rather than a 403, so probing session ids
  // cannot confirm which ones exist.
  if (user.role !== "owner" && !user.lotIds.includes(DEFAULT_LOT_ID)) {
    notFound();
  }

  const t = await getTranslations("receipt");
  const ts = await getTranslations("staff");
  const tc = await getTranslations("common");

  const [session, lot] = await Promise.all([
    getSession(DEFAULT_LOT_ID, sessionId),
    getLotProfile(DEFAULT_LOT_ID),
  ]);

  if (!session || !session.fee || session.status !== "completed") notFound();

  const timeZone = lot?.timeZone ?? "Asia/Dubai";
  const attendantName = await resolveAttendantName(session.attendantOutUid);

  return (
    <div className="mx-auto w-full max-w-80 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton label={t("print")} />
      </div>

      <article className="bg-surface border-border rounded-card border p-5 font-mono text-[0.8125rem] leading-relaxed print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="border-border mb-3 border-b border-dashed pb-3 text-center">
          <h1 className="text-sm font-bold tracking-wide uppercase">
            {lot?.name ?? "Parking"}
          </h1>
          {lot?.address && (
            <p className="mt-1 text-[0.6875rem]">{lot.address}</p>
          )}
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>{t("receiptNo")}</dt>
          <dd className="text-end font-semibold">{session.receiptNo}</dd>

          <dt>{tc("plate")}</dt>
          <dd className="text-end font-semibold">
            {formatPlateOrDash(session.plate)}
          </dd>

          <dt>{tc("slot")}</dt>
          <dd className="text-end">{session.slotCode}</dd>

          <dt>{ts("timeIn")}</dt>
          <dd className="text-end">
            {formatDateTimeInZone(session.entryAt, timeZone)}
          </dd>

          <dt>{ts("timeOut")}</dt>
          <dd className="text-end">
            {session.exitAt
              ? formatDateTimeInZone(session.exitAt, timeZone)
              : "—"}
          </dd>

          <dt>{ts("duration")}</dt>
          <dd className="text-end">
            {formatDuration(session.fee.durationMinutes)}
          </dd>
        </dl>

        <div className="border-border my-3 border-t border-dashed pt-3">
          {session.fee.lines.map((line, index) => (
            <div key={index} className="flex justify-between gap-3">
              <span>{line.label}</span>
              <span className="shrink-0 tabular-nums">
                {formatAed(line.amountFils)}
              </span>
            </div>
          ))}

          {session.discountFils > 0 && (
            <div className="mt-1 flex justify-between gap-3">
              <span>Discount</span>
              <span className="shrink-0 tabular-nums">
                -{formatAed(session.discountFils)}
              </span>
            </div>
          )}
        </div>

        {session.fee.vatFils > 0 && (
          <div className="border-border border-t border-dashed pt-2">
            <div className="flex justify-between gap-3">
              <span>{t("subtotal")}</span>
              <span className="tabular-nums">
                {formatAed(session.fee.netFils)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>
                {t("vat", { percent: session.rateSnapshot.vat.ratePercent })}
              </span>
              <span className="tabular-nums">
                {formatAed(session.fee.vatFils)}
              </span>
            </div>
          </div>
        )}

        <div className="border-border mt-2 flex justify-between gap-3 border-t-2 pt-2 text-sm font-bold">
          <span>{t("totalPaid")}</span>
          <span className="tabular-nums">
            {formatAed(session.fee.totalFils)}
          </span>
        </div>

        <p className="mt-1 text-center text-[0.6875rem]">{t("paidCash")}</p>

        <footer className="border-border mt-3 border-t border-dashed pt-3 text-center text-[0.6875rem]">
          <p>
            {t("attendant")}: {attendantName}
          </p>
          {session.rateSnapshot.vat.registered && (
            <p className="mt-1">
              {session.rateSnapshot.vat.pricesIncludeVat
                ? "Prices include VAT"
                : "VAT added at exit"}
            </p>
          )}
          <p className="mt-2">{t("thankYou")}</p>
        </footer>
      </article>
    </div>
  );
}

async function resolveAttendantName(uid: string | null): Promise<string> {
  if (!uid) return "—";
  try {
    const record = await adminAuth.getUser(uid);
    return record.displayName || record.email || uid;
  } catch {
    return uid;
  }
}
