import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "occupied" | "vip" | "muted";

const TONES: Record<Tone, { card: string; figure: string }> = {
  neutral: { card: "bg-surface border-border", figure: "text-text" },
  accent: {
    card: "bg-accent-soft border-free-border/40",
    figure: "text-free",
  },
  occupied: {
    card: "bg-occupied-surface border-occupied-border/60",
    figure: "text-occupied",
  },
  vip: { card: "bg-vip-surface border-vip-border/60", figure: "text-vip" },
  muted: { card: "bg-surface-2 border-border", figure: "text-muted" },
};

/**
 * The mockups' statistic card: a small uppercase label, an oversized figure,
 * and an optional line of context. The figure is the point — a driver or an
 * owner should be able to read it across a room.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  trend?: { direction: "up" | "down"; label: string };
}) {
  const styles = TONES[tone];

  return (
    <div className={cn("rounded-card border p-4", styles.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="stat-label">{label}</p>
        {icon && <span className="text-muted shrink-0">{icon}</span>}
      </div>

      <p
        className={cn(
          "display-figure mt-2 text-3xl sm:text-4xl",
          styles.figure,
        )}
      >
        {value}
      </p>

      {(hint || trend) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs">
          {trend && (
            <span
              className={cn(
                "font-semibold",
                trend.direction === "up" ? "text-free" : "text-occupied",
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"} {trend.label}
            </span>
          )}
          {hint && <span className="text-muted">{hint}</span>}
        </p>
      )}
    </div>
  );
}
