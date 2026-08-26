"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "bg-surface-2 border-border text-text placeholder:text-faint rounded-control " +
  "min-h-11 w-full border px-3 text-[0.9375rem] transition " +
  "focus:border-accent-ring focus:outline-none";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-faint text-xs">{hint}</p>}
      {error && (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, className)} {...props}>
      {children}
    </select>
  );
}
