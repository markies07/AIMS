import { setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { listSlots } from "@/lib/data/lot";
import { SlotManager } from "@/components/owner/SlotManager";

export const dynamic = "force-dynamic";

export default async function OwnerSlotsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const slots = await listSlots(DEFAULT_LOT_ID);
  return <SlotManager lotId={DEFAULT_LOT_ID} slots={slots} />;
}
