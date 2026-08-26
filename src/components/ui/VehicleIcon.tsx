import type { VehicleType } from "@/lib/types";

/**
 * Inline SVG rather than an icon font or remote asset: these render on the
 * public page above the fold, and a missing glyph would leave a driver unable
 * to tell which count is which.
 */
export function VehicleIcon({
  type,
  className,
}: {
  type: VehicleType;
  className?: string;
}) {
  if (type === "motorcycle") {
    return (
      <svg
        viewBox="0 0 48 32"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <circle
          cx="10"
          cy="23"
          r="6.5"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle
          cx="38"
          cy="23"
          r="6.5"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path
          d="M10 23l7-11h9l5 11M26 12h6M17 12l-3-4H9"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 22v-4.5c0-.8.4-1.5 1.1-1.8l4-2 4.2-5.2c.6-.7 1.4-1.1 2.3-1.1h13.6c.9 0 1.8.4 2.4 1.2l4 5.1 5 2c.8.3 1.4 1.1 1.4 2V22a2 2 0 0 1-2 2h-2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 24H6a2 2 0 0 1-2-2M32 24H16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M13 14h22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="24" r="3.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="34" cy="24" r="3.5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
