import { setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { listActiveSessions } from "@/lib/data/lot";
import {
  VehicleOutForm,
  type SearchableSession,
} from "@/components/staff/VehicleOutForm";

export const dynamic = "force-dynamic";

export default async function VehicleOutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessions = await listActiveSessions(DEFAULT_LOT_ID);

  // Vehicles in the lot are bounded by the slot count, so the whole set is a
  // cheap payload. That is what lets "search any part of the plate" (§8) be an
  // instant in-memory filter with no round trip per keystroke.
  const searchable: SearchableSession[] = sessions.map((s) => ({
    id: s.id,
    plateNormalized: s.plate.normalized,
    plateLabel: [s.plate.emirate, s.plate.code, s.plate.number]
      .filter(Boolean)
      .join(" · "),
    slotCode: s.slotCode,
    vehicleType: s.vehicleType,
    entryAtMs: s.entryAt.getTime(),
    status: s.status,
  }));

  return <VehicleOutForm lotId={DEFAULT_LOT_ID} sessions={searchable} />;
}
