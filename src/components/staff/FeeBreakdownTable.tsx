import { useTranslations } from "next-intl";
import { formatAed } from "@/lib/money";
import type { FeeBreakdown } from "@/lib/types";

/**
 * §6 — "most parking disputes disappear the moment the customer can see the
 * maths". This table is shown on the attendant's screen and printed on the
 * receipt, so the driver can follow every line of the calculation.
 */
export function FeeBreakdownTable({
  fee,
  vatPercent,
}: {
  fee: FeeBreakdown;
  vatPercent: number;
}) {
  const t = useTranslations("receipt");

  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {fee.lines.map((line, index) => (
          <tr key={`${line.kind}-${index}`}>
            <td className="text-muted py-1.5 pe-2">{line.label}</td>
            <td className="text-text py-1.5 text-end font-medium tabular-nums">
              {formatAed(line.amountFils)}
            </td>
          </tr>
        ))}

        {fee.vatFils > 0 && (
          <>
            <tr className="border-border border-t">
              <td className="text-muted py-1.5 pe-2">{t("subtotal")}</td>
              <td className="text-text py-1.5 text-end tabular-nums">
                {formatAed(fee.netFils)}
              </td>
            </tr>
            <tr>
              <td className="text-muted py-1.5 pe-2">
                {t("vat", { percent: vatPercent })}
              </td>
              <td className="text-text py-1.5 text-end tabular-nums">
                {formatAed(fee.vatFils)}
              </td>
            </tr>
          </>
        )}

        <tr className="border-border border-t-2">
          <td className="text-text py-2 pe-2 font-semibold">
            {t("totalPaid")}
          </td>
          <td className="text-text py-2 text-end text-lg font-bold tabular-nums">
            {formatAed(fee.totalFils)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
