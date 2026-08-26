import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, MapPin, Navigation } from "lucide-react";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile } from "@/lib/data/lot";
import { Card, PageHeader, SectionHeader } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function LocationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("rates");
  const tp = await getTranslations("public");
  const lot = await getLotProfile(DEFAULT_LOT_ID).catch(() => null);

  return (
    <>
      <PageHeader title={tp("location")} subtitle={lot?.name ?? undefined} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <SectionHeader title={t("address")} />
          <p className="text-text flex items-start gap-2 text-sm">
            <MapPin className="text-muted mt-0.5 size-4 shrink-0" />
            {lot?.address || "—"}
          </p>

          {lot?.mapsUrl && (
            <a
              href={lot.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-control bg-ink text-ink-text hover:bg-ink-hover mt-4 inline-flex min-h-11 items-center gap-2 px-5 text-sm font-semibold transition"
            >
              <Navigation className="size-4" />
              {tp("getDirections")}
            </a>
          )}
        </Card>

        <Card>
          <SectionHeader title={t("openingHours")} />
          <p className="text-text flex items-center gap-2 text-sm">
            <Clock className="text-muted size-4 shrink-0" />
            {lot?.open24
              ? t("openAllHours")
              : `${lot?.opensAt ?? "—"} – ${lot?.closesAt ?? "—"}`}
          </p>
        </Card>
      </div>
    </>
  );
}
