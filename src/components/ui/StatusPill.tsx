import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillTone = "free" | "occupied" | "vip" | "muted" | "accent";

const TONES: Record<PillTone, string> = {
  free: "bg-accent-soft text-free",
  occupied: "bg-occupied-surface text-occupied",
  vip: "bg-vip-surface text-vip",
  muted: "bg-surface-3 text-muted",
  accent: "bg-accent text-accent-text",
};

/** The small rounded status chips in the activity tables — "Occupied", "Paid". */
export function StatusPill({
  children,
  tone = "muted",
  dot,
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONES[tone],
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * A UAE plate rendered as it appears on the vehicle — emirate on a tinted
 * flag, then the code and number. Far faster for an attendant to match against
 * the car in front of them than a run-together string.
 */
export function PlateBadge({
  emirate,
  code,
  number,
  className,
}: {
  emirate: string;
  code: string;
  number: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border bg-surface inline-flex items-center overflow-hidden rounded border text-sm",
        className,
      )}
    >
      {emirate && (
        <span className="bg-surface-3 text-muted px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide uppercase">
          {emirate}
        </span>
      )}
      <span className="text-text px-2 py-0.5 font-semibold tracking-wider tabular-nums">
        {[code, number].filter(Boolean).join(" ")}
      </span>
    </span>
  );
}
