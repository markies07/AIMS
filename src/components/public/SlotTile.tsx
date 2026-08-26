import type { PublicSlot, SlotStatus } from "@/lib/types";
import { ParkingSpace } from "@/components/ui/ParkingSpace";

const LABELS: Record<SlotStatus, string> = {
  available: "free",
  assigned: "reserved",
  occupied: "taken",
  out_of_service: "out of service",
};

/** One parking space on the public map — see `ParkingSpace` for the visual. */
export function SlotTile({ slot }: { slot: PublicSlot }) {
  return (
    <div role="listitem" aria-label={`${slot.code}, ${LABELS[slot.status]}`}>
      <ParkingSpace
        code={slot.code}
        status={slot.status}
        vehicleType={slot.vehicleType}
      />
    </div>
  );
}
