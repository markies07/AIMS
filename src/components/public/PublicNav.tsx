"use client";

// Both from the i18n helpers, never from `next/navigation`: that one reports
// the locale-prefixed path ("/en/rates") while these hrefs are locale-less
// ("/rates"), so nothing would ever match and no tab would light up.
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** The public site's primary navigation, with the current page underlined. */
export function PublicNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 pb-0.5 text-sm transition",
              active
                ? "border-accent text-text font-semibold"
                : "text-muted hover:text-text border-transparent font-medium",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
