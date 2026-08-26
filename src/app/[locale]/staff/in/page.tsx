import { setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { listSlots } from "@/lib/data/lot";
import { VehicleInForm } from "@/components/staff/VehicleInForm";

export const dynamic = "force-dynamic";

export default async function VehicleInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The full list, not just the free ones: the picker shows taken slots greyed
  // out so the attendant sees the real shape of the lot rather than a shifting
  // subset, which is much easier to scan against the painted numbers outside.
  const slots = await listSlots(DEFAULT_LOT_ID);

  return <VehicleInForm lotId={DEFAULT_LOT_ID} slots={slots} />;
}
