import type { ReactNode } from "react";
import { Ban, Car, Clock } from "lucide-react";

import { cn } from "@/lib/cn";
import type { SlotStatus, VehicleType } from "@/lib/types";
import { VehicleSprite } from "./VehicleSprite";

const WASH: Record<SlotStatus, string> = {
  available: "bay-free",
  assigned: "bay-held",
  occupied: "bay-taken",
  out_of_service: "bay-oos",
};

/**
 * One marked-out parking space, drawn as a view straight down onto the tarmac.
 *
 * The painted line runs down the inline-end edge only, so that in a run of
 * bays each line is shared between neighbours exactly as it is on a real lot —
 * which is why the grids that use this set no gap between cells.
 *
 * A free bay shows its code large, because that is the one thing a driver
 * scanning the map is looking for. An occupied bay shows the vehicle instead
 * and drops the code to a chip, because there the vehicle *is* the message.
 */
export function ParkingSpace({
  code,
  status,
  vehicleType,
  sublabel,
  size = "md",
  selected = false,
  className,
}: {
  code: string;
  status: SlotStatus;
  vehicleType: VehicleType;
  /** A plate number, or the vehicle class on the owner's editor. */
  sublabel?: string;
  size?: "sm" | "md";
  /** The bay the attendant has picked for the vehicle at the gate. */
  selected?: boolean;
  className?: string;
}) {
  const small = size === "sm";

  return (
    <div
      className={cn(
        // A real bay is about 2.5m by 5m. Not quite that narrow here, or the
        // code would not fit across it on a phone, but tall enough that a run
        // of them reads as stalls rather than as a row of tiles.
        "relative flex aspect-5/8 flex-col items-center justify-center overflow-hidden",
        // The line down the inline-end edge is shared with the next bay along.
        // The fainter one across the foot separates one row of bays from the
        // row behind it — without it the side lines run unbroken down several
        // rows and the stalls read as long lanes.
        "border-e-2 border-b border-e-white/85 border-b-white/20",
        WASH[status],
        className,
      )}
    >
      {/* Wheel stop at the head of the space. */}
      {status !== "out_of_service" && (
        <span
          aria-hidden="true"
          className="bay-stop absolute top-[11%] h-[2px] w-[42%] rounded-full"
        />
      )}

      {/*
        The pick made at the gate. Painted over the bay rather than swapping its
        colours, so the space underneath still reads as the free bay it is —
        and rendered before the code, which is `relative` so it stays on top.
      */}
      {selected && (
        <span
          aria-hidden="true"
          className="bg-accent/65 pointer-events-none absolute inset-0 ring-2 ring-white ring-inset"
        />
      )}

      {status === "available" && (
        <span
          className={cn(
            "bay-code relative font-bold tracking-tight tabular-nums",
            small ? "text-[0.6875rem]" : "text-[0.8125rem] sm:text-sm",
          )}
        >
          {code}
        </span>
      )}

      {status === "occupied" && (
        <VehicleSprite type={vehicleType} />
      )}

      {status === "assigned" && (
        <>
          <VehicleSprite type={vehicleType} ghost />
          {/* Pulsing border says "someone is on their way to this one". */}
          <span
            aria-hidden="true"
            className="bay-hold-ring pointer-events-none absolute inset-[6%] rounded-sm border-2 border-dashed border-white"
          />
          <Clock
            className={cn(
              "absolute top-1 end-1 text-white drop-shadow",
              small ? "size-3" : "size-3.5",
            )}
          />
        </>
      )}

      {status === "out_of_service" && (
        <Ban
          className={cn("text-white drop-shadow", small ? "size-4" : "size-5")}
        />
      )}

      {/*
        The code, and any second line, captioned over the tarmac. A gradient
        rather than a solid bar: it keeps the bottom of the vehicle visible, so
        the bay still reads as a photograph of a space rather than a tile with
        a label stuck under it.
      */}
      {status !== "available" && (
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/35 to-transparent px-1 pt-4 pb-0.5 text-center">
          <span className="block truncate text-[0.625rem] leading-tight font-bold text-white tabular-nums">
            {code}
          </span>
          {sublabel && (
            <span className="block truncate text-[0.5625rem] leading-tight text-white/75">
              {sublabel}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * The strip of tarmac the bays face onto. Decorative — it carries the dashed
 * centre line and the map's only ambient movement, which is what stops a busy
 * lot from reading as a static diagram.
 */
export function LotAisle({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("lot-aisle h-5 sm:h-7", className)} />
  );
}

/**
 * The key to the map, and it lives next to `ParkingSpace` because it can only
 * be right if it is built from the same pieces.
 *
 * Each swatch is a miniature of the real bay rather than a colour chip: on this
 * map the states are told apart mostly by what is standing in the space, so a
 * row of four coloured squares would describe a map we no longer draw.
 */
export function SlotLegend({
  labels,
}: {
  labels: {
    free: string;
    taken: string;
    reserved: string;
    outOfService: string;
    /** Only the gate's slot picker has a selection to explain. */
    selected?: string;
  };
}) {
  const items: { key: string; label: string; chip: ReactNode }[] = [
    {
      key: "free",
      label: labels.free,
      chip: <span className="bay-free absolute inset-0" />,
    },
    {
      key: "taken",
      label: labels.taken,
      chip: <Car className="size-2.5 text-white" strokeWidth={2.5} />,
    },
    {
      key: "reserved",
      label: labels.reserved,
      chip: (
        <span className="bay-held absolute inset-0 border border-dashed border-white/80" />
      ),
    },
    {
      key: "outOfService",
      label: labels.outOfService,
      chip: <span className="bay-oos absolute inset-0" />,
    },
    ...(labels.selected
      ? [
          {
            key: "selected",
            label: labels.selected,
            chip: (
              <span className="bg-accent/65 absolute inset-0 ring-2 ring-white ring-inset" />
            ),
          },
        ]
      : []),
  ];

  return (
    <ul className="text-muted flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span className="lot-asphalt relative flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm border-e-2 border-white/70">
            {item.chip}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
