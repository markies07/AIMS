import { setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { listActiveSessions, listSlots } from "@/lib/data/lot";
import { StaffLotMap, type MappedSlot } from "@/components/staff/StaffLotMap";

export const dynamic = "force-dynamic";

/** §7 — the full picture, with plate numbers visible to staff. */
export default async function LotMapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [slots, sessions] = await Promise.all([
    listSlots(DEFAULT_LOT_ID),
    listActiveSessions(DEFAULT_LOT_ID),
  ]);

  const bySlotId = new Map(sessions.map((s) => [s.slotId, s]));

  const mapped: MappedSlot[] = slots.map((slot) => {
    const session = bySlotId.get(slot.id);
    return {
      id: slot.id,
      code: slot.code,
      level: slot.level,
      vehicleType: slot.vehicleType,
      status: slot.status,
      outOfServiceReason: slot.outOfServiceReason,
      session: session
        ? {
            id: session.id,
            plateLabel: [
              session.plate.emirate,
              session.plate.code,
              session.plate.number,
            ]
              .filter(Boolean)
              .join(" · "),
            entryAtMs: session.entryAt.getTime(),
            status: session.status,
          }
        : null,
    };
  });

  return <StaffLotMap lotId={DEFAULT_LOT_ID} slots={mapped} />;
}
