import { setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getActiveRate, listRates } from "@/lib/data/lot";
import { RateEditor, type RateSummary } from "@/components/owner/RateEditor";

export const dynamic = "force-dynamic";

export default async function OwnerRatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [active, all] = await Promise.all([
    getActiveRate(DEFAULT_LOT_ID),
    listRates(DEFAULT_LOT_ID),
  ]);

  const history: RateSummary[] = all.map((rate) => ({
    id: rate.id,
    effectiveFromMs: rate.effectiveFrom.getTime(),
    carFirstHourFils: rate.car.firstHourFils,
    carSubsequentFils: rate.car.subsequentHourFils,
    motorcycleFirstHourFils: rate.motorcycle.firstHourFils,
    motorcycleSubsequentFils: rate.motorcycle.subsequentHourFils,
    isActive: rate.id === active?.id,
  }));

  return (
    <RateEditor
      lotId={DEFAULT_LOT_ID}
      current={
        active
          ? {
              car: active.car,
              motorcycle: active.motorcycle,
              vat: active.vat,
            }
          : null
      }
      history={history}
    />
  );
}
