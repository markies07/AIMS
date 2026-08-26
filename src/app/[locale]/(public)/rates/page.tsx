import { getTranslations, setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getActiveRate, getLotProfile } from "@/lib/data/lot";
import { formatAed } from "@/lib/money";
import { VEHICLE_TYPES, type VehicleRate } from "@/lib/types";
import { Card, SectionHeader } from "@/components/ui/Card";
import { VehicleIcon } from "@/components/ui/VehicleIcon";

export const dynamic = "force-dynamic";

/**
 * §7 — the public rates page. It reads the same rate document the exit gate
 * charges from, so the posted price and the price collected cannot disagree.
 */
export default async function RatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("rates");
  const tc = await getTranslations("common");

  const [rate, lot] = await Promise.all([
    getActiveRate(DEFAULT_LOT_ID).catch(() => null),
    getLotProfile(DEFAULT_LOT_ID).catch(() => null),
  ]);

  if (!rate) {
    return (
      <Card>
        <p className="text-muted text-sm">Rates are not published yet.</p>
      </Card>
    );
  }

  const rows: { label: string; value: (r: VehicleRate) => string }[] = [
    { label: t("firstHour"), value: (r) => formatAed(r.firstHourFils) },
    {
      label: t("eachHourAfter"),
      value: (r) => formatAed(r.subsequentHourFils),
    },
    {
      label: t("gracePeriod"),
      value: (r) => t("graceValue", { minutes: r.graceMinutes }),
    },
    {
      label: t("dailyMaximum"),
      value: (r) =>
        r.dailyMaxFils === null ? t("noMaximum") : formatAed(r.dailyMaxFils),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader title={t("title")} />

        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-md border-collapse text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="py-2.5 ps-1 text-start font-medium" />
                {VEHICLE_TYPES.map((type) => (
                  <th key={type} className="py-2.5 pe-1 text-end font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <VehicleIcon type={type} className="text-muted w-7" />
                      {type === "car" ? tc("car") : tc("motorcycle")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-border/60 border-b">
                  <td className="text-muted py-3 ps-1">{row.label}</td>
                  {VEHICLE_TYPES.map((type) => (
                    <td
                      key={type}
                      className="text-text py-3 pe-1 text-end font-medium tabular-nums"
                    >
                      {row.value(type === "car" ? rate.car : rate.motorcycle)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-faint mt-4 text-xs">{t("roundingNote")}</p>

        {rate.vat.registered && (
          <p className="text-muted mt-2 text-xs">
            {rate.vat.pricesIncludeVat
              ? t("vatIncluded", { percent: rate.vat.ratePercent })
              : t("vatExcluded", { percent: rate.vat.ratePercent })}
          </p>
        )}
      </Card>

      {lot && (
        <Card>
          <SectionHeader title={t("openingHours")} />
          <p className="text-text text-sm">
            {lot.open24
              ? t("openAllHours")
              : `${lot.opensAt ?? "—"} – ${lot.closesAt ?? "—"}`}
          </p>
          {lot.address && (
            <>
              <h3 className="text-muted mt-4 text-sm font-medium">
                {t("address")}
              </h3>
              <p className="text-text mt-1 text-sm">{lot.address}</p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
