import Image from "next/image";

import { cn } from "@/lib/cn";
import type { VehicleType } from "@/lib/types";

/**
 * The artwork that sits in an occupied bay, picked by what the attendant
 * recorded at the gate.
 *
 * Intrinsic sizes are declared so Next can serve a small optimised variant
 * rather than the full-resolution original — a lot map renders dozens of these
 * at roughly 90px wide, and the source files are ~300KB each. Every bay of the
 * same type shares one URL, so the browser fetches each vehicle once.
 */
const SPRITES: Record<
  VehicleType,
  { src: string; width: number; height: number }
> = {
  // Drawn nose-up already.
  car: { src: "/vehicle type/car.png", width: 855, height: 1899 },
  // Drawn facing left — turned to face down the bay by the rotation below.
  motorcycle: { src: "/vehicle type/motorcycle.png", width: 774, height: 558 },
};

export function VehicleSprite({
  type,
  /** Dimmed, for a bay held for a driver who has not arrived yet. */
  ghost = false,
  animate = true,
  className,
}: {
  type: VehicleType;
  ghost?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const sprite = SPRITES[type];
  const upright = type === "motorcycle";

  return (
    <Image
      src={sprite.src}
      alt=""
      aria-hidden="true"
      width={sprite.width}
      height={sprite.height}
      sizes="140px"
      className={cn(
        "pointer-events-none max-w-none select-none",
        // Sized against the bay: the car by height (it is the long dimension
        // once parked), the scooter by width, because it is rotated a quarter
        // turn and its pre-rotation width becomes its height on screen.
        upright ? "h-auto w-[80%] -rotate-90" : "h-[78%] w-auto",
        ghost
          ? "opacity-40 grayscale"
          : "drop-shadow-[0_3px_4px_rgb(0_0_0_/_0.55)]",
        animate && "vehicle-arrive",
        className,
      )}
    />
  );
}
