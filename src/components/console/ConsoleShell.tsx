"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  Car,
  Clock,
  LayoutGrid,
  LogOut,
  Map,
  Receipt,
  Search,
  Settings,
  Users,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const ICONS = {
  dashboard: LayoutGrid,
  vehicles: Car,
  map: Map,
  search: Search,
  shift: Clock,
  reports: BarChart3,
  staff: Users,
  slots: LayoutGrid,
  rates: Receipt,
  settings: Settings,
} as const;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/**
 * The console frame: a persistent sidebar on desktop, a bottom bar on phones.
 *
 * Attendants work standing at a gate, one-handed, so on a small screen the
 * navigation sits within thumb reach at the bottom rather than in the top-left
 * corner where a desktop sidebar would put it.
 */
export function ConsoleShell({
  items,
  title,
  subtitle,
  userName,
  headerRight,
  children,
}: {
  items: NavItem[];
  title: string;
  subtitle: string;
  userName: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  // The most specific href that matches wins — otherwise a root item like
  // "/owner" would stay lit on every sub-page ("/owner/slots" starts with
  // "/owner/" too), highlighting two tabs at once.
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const isActive = (href: string) => href === activeHref;

  return (
    <div className="flex min-h-full flex-1">
      {/* ---- Sidebar (desktop) ------------------------------------- */}
      <aside className="border-border bg-surface hidden w-60 shrink-0 flex-col border-e lg:flex">
        <div className="px-5 py-5">
          <p className="text-text text-lg leading-tight font-bold tracking-tight">
            {title}
          </p>
          <p className="text-muted text-xs">{subtitle}</p>
        </div>

        <nav className="flex-1 px-3">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-control flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-ink text-ink-text"
                        : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-border mx-3 mt-4 mb-3 border-t pt-3">
          <p className="text-faint truncate px-3 pb-2 text-xs">{userName}</p>
        </div>
      </aside>

      {/* ---- Main ---------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-surface sticky top-0 z-20 border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 lg:hidden">
              <p className="text-text truncate font-bold">{title}</p>
              <p className="text-faint truncate text-xs">{userName}</p>
            </div>
            <div className="hidden lg:block" />
            <div className="flex shrink-0 items-center gap-2">
              {headerRight}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* ---- Bottom bar (phones) ------------------------------------ */}
      <nav className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="flex items-stretch justify-around">
          {items.slice(0, 5).map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <li key={item.href} className="min-w-0 flex-1 px-1 py-1.5">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-control flex flex-col items-center gap-1 px-1 py-1.5 text-[0.6875rem] font-medium transition",
                    active
                      ? "bg-ink text-ink-text"
                      : "text-muted hover:text-text",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="w-full truncate text-center">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Sign-out lives in the header on every console screen. */
export function SignOutLink({ label }: { label: string }) {
  return (
    <span className="text-muted flex items-center gap-1.5 text-sm">
      <LogOut className="size-4" />
      {label}
    </span>
  );
}
