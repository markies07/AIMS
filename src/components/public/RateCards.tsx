import { getTranslations } from "next-intl/server";
import { formatAed } from "@/lib/money";
import type { Rate, VehicleRate, VehicleType } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { VehicleIcon } from "@/components/ui/VehicleIcon";

/**
 * The rate cards from the mockup, read from the same rate document the exit
 * gate charges from — so the posted price and the price collected cannot
 * disagree.
 */
export async function RateCards({ rate }: { rate: Rate }) {
  const t = await getTranslations("rates");
  const tc = await getTranslations("common");

  const cards: {
    type: VehicleType;
    title: string;
    hint: string;
    rate: VehicleRate;
  }[] = [
    {
      type: "car",
      title: t("automobiles"),
      hint: t("automobilesHint"),
      rate: rate.car,
    },
    {
      type: "motorcycle",
      title: tc("motorcycles"),
      hint: t("motorcyclesHint"),
      rate: rate.motorcycle,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <Card key={card.type}>
          <div className="flex items-center gap-3">
            <span className="bg-surface-2 text-text flex size-11 shrink-0 items-center justify-center rounded-full">
              <VehicleIcon type={card.type} className="w-6" />
            </span>
            <div>
              <h3 className="text-text text-base font-bold">{card.title}</h3>
              <p className="text-muted text-sm">{card.hint}</p>
            </div>
          </div>

          <dl className="border-border mt-4 border-t pt-3 text-sm">
            <Row
              label={t("firstHour")}
              value={formatAed(card.rate.firstHourFils)}
            />
            <Row
              label={t("additionalHour")}
              value={formatAed(card.rate.subsequentHourFils)}
            />
            <Row
              label={t("gracePeriod")}
              value={t("graceValue", { minutes: card.rate.graceMinutes })}
            />
            <Row
              label={t("dailyMaximum")}
              value={
                card.rate.dailyMaxFils === null
                  ? t("noMaximum")
                  : formatAed(card.rate.dailyMaxFils)
              }
            />
          </dl>
        </Card>
      ))}

      <p className="text-muted sm:col-span-2 text-xs">
        {t("roundingNote")}
        {rate.vat.registered && (
          <>
            {" "}
            {rate.vat.pricesIncludeVat
              ? t("vatIncluded", { percent: rate.vat.ratePercent })
              : t("vatExcluded", { percent: rate.vat.ratePercent })}
          </>
        )}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 flex items-baseline justify-between gap-3 border-b py-2.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-text font-bold tabular-nums">{value}</dd>
    </div>
  );
}
