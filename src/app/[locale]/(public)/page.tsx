import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Clock, MapPin, Navigation, Receipt } from "lucide-react";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getActiveRate, getLotProfile, getPublicView } from "@/lib/data/lot";
import { Link } from "@/i18n/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import { RateCards } from "@/components/public/RateCards";
import { LiveCountBadge } from "@/components/public/LiveCountBadge";

export const dynamic = "force-dynamic";

/**
 * The landing page.
 *
 * The one thing a driver came for — how many spaces are free — is in the hero,
 * not buried a click away. Everything below it is context for someone who has
 * not been here before; a returning driver takes the availability link and
 * never reads it.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("public");
  const tr = await getTranslations("rates");

  const [view, lot, rate] = await Promise.all([
    getPublicView(DEFAULT_LOT_ID).catch(() => null),
    getLotProfile(DEFAULT_LOT_ID).catch(() => null),
    getActiveRate(DEFAULT_LOT_ID).catch(() => null),
  ]);

  const free = view ? view.freeByType.car + view.freeByType.motorcycle : null;
  const total = view?.statusCounts.total ?? 0;

  return (
    <div className="flex flex-col gap-10">
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="rounded-card relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-ink via-ink absolute inset-0 bg-linear-to-br to-[#123c2c]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 22px)",
          }}
        />

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <LiveCountBadge
              lotId={DEFAULT_LOT_ID}
              initialFree={free}
              labels={{
                available: t("parkingAvailable"),
                full: t("lotFull"),
              }}
            />

            <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {lot?.name ?? "Parking"}
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/70 sm:text-base">
              {t("heroSubtitle")}
            </p>

            {lot?.address && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-white/60">
                <MapPin className="size-4 shrink-0" />
                {lot.address}
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/availability"
                className="rounded-control bg-accent text-accent-text hover:bg-accent-hover inline-flex min-h-12 items-center gap-2 px-6 font-semibold transition"
              >
                {t("checkAvailability")}
                <ArrowRight className="size-4" />
              </Link>
              {lot?.mapsUrl && (
                <a
                  href={lot.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-control inline-flex min-h-12 items-center gap-2 border border-white/25 px-6 font-semibold text-white transition hover:bg-white/10"
                >
                  <Navigation className="size-4" />
                  {t("getDirections")}
                </a>
              )}
            </div>
          </div>

          {/* The number, large enough to read from a phone at arm's length */}
          <div className="rounded-card bg-white/10 px-8 py-6 backdrop-blur lg:min-w-56">
            <p className="stat-label text-white/60">{t("availableNow")}</p>
            <p className="display-figure text-accent-strong mt-2 text-6xl sm:text-7xl">
              {free ?? "—"}
            </p>
            {total > 0 && (
              <p className="mt-2 text-sm text-white/50">
                {t("ofTotal", { total })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---- Why check first ----------------------------------------- */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Feature
          icon={<Clock className="size-5" />}
          title={t("featureLiveTitle")}
          body={t("featureLiveBody")}
        />
        <Feature
          icon={<Receipt className="size-5" />}
          title={t("featureFairTitle")}
          body={t("featureFairBody")}
        />
        <Feature
          icon={<MapPin className="size-5" />}
          title={t("featureNoTripTitle")}
          body={t("featureNoTripBody")}
        />
      </section>

      {/* ---- Rates --------------------------------------------------- */}
      {rate && (
        <section>
          <SectionHeader
            title={t("standardRates")}
            action={
              <Link
                href="/rates"
                className="text-muted hover:text-text inline-flex items-center gap-1 text-sm font-medium"
              >
                {tr("openingHours")}
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <RateCards rate={rate} />
        </section>
      )}
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <span className="bg-accent-soft text-free mb-3 flex size-10 items-center justify-center rounded-full">
        {icon}
      </span>
      <h3 className="text-text text-base font-bold">{title}</h3>
      <p className="text-muted mt-1 text-sm">{body}</p>
    </Card>
  );
}
