import { getTranslations, setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile, getPublicView } from "@/lib/data/lot";
import { toDto } from "@/lib/data/publicViewDto";
import { AvailabilityBoard } from "@/components/public/AvailabilityBoard";
import { Card } from "@/components/ui/Card";

/**
 * The live availability board.
 *
 * Rendered fresh on every request rather than cached: a stale free-slot count
 * is worse than a slow one, because it sends a driver across Dubai to a full
 * lot — the exact problem §2 says this system exists to solve.
 */
export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("public");

  const [view, lot] = await Promise.all([
    getPublicView(DEFAULT_LOT_ID).catch((error) => {
      console.error("[availability] could not load public view", error);
      return null;
    }),
    getLotProfile(DEFAULT_LOT_ID).catch(() => null),
  ]);

  if (!view) {
    return (
      <Card>
        <p className="text-muted text-sm">{t("unavailable")}</p>
      </Card>
    );
  }

  return (
    <AvailabilityBoard
      initial={toDto(view)}
      lotId={DEFAULT_LOT_ID}
      mapsUrl={lot?.mapsUrl ?? null}
    />
  );
}
