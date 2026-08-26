import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ink" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  /** Emerald — the affirmative action. "Vehicle In", "Confirm Entry". */
  primary: "bg-accent text-accent-text hover:bg-accent-hover font-semibold",
  /** Black — the other heavyweight action. "Vehicle Out", "Get Directions". */
  ink: "bg-ink text-ink-text hover:bg-ink-hover font-semibold",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-2 font-medium",
  ghost: "text-muted hover:bg-surface-2 hover:text-text font-medium",
  danger:
    "bg-danger-surface text-danger border border-occupied-border hover:brightness-[0.98] font-medium",
};

const SIZES: Record<Size, string> = {
  // Generous hit areas: attendants tap these hundreds of times a shift, often
  // one-handed at a gate.
  sm: "min-h-9 px-3.5 text-sm gap-1.5",
  md: "min-h-11 px-5 text-[0.9375rem] gap-2",
  lg: "min-h-13 px-6 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-control inline-flex items-center justify-center transition",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
