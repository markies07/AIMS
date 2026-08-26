import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

import { pickMessages } from "@/i18n/messages";

import { Link } from "@/i18n/navigation";
import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile } from "@/lib/data/lot";
import { PublicNav } from "@/components/public/PublicNav";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("public");
  const lot = await getLotProfile(DEFAULT_LOT_ID).catch(() => null);
  const name = lot?.name ?? "Parking";

  // Only what the public client components render — never the console strings.
  const messages = await pickMessages(["public", "common", "rates"]);

  const links = [
    { href: "/", label: t("home") },
    { href: "/availability", label: t("availability") },
    { href: "/rates", label: t("rates") },
    { href: "/location", label: t("location") },
  ];

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-border bg-surface sticky top-0 z-20 border-b">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
            <Link
              href="/"
              className="text-text text-lg font-bold tracking-tight"
            >
              {name}
            </Link>

            <PublicNav links={links} />

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/availability"
                className="bg-ink text-ink-text rounded-control hover:bg-ink-hover hidden min-h-9 items-center px-4 text-sm font-semibold transition sm:inline-flex"
              >
                {t("checkAvailability")}
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          {children}
        </main>

        <footer className="bg-ink text-ink-text mt-12">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6">
            <p className="text-base font-bold">{name}</p>
            {/*
            No staff sign-in link here by design. The console lives at /admin,
            unadvertised — one less thing for a passing visitor to probe, and
            attendants reach it by bookmark. It is not a security control on its
            own (the route is still guarded server-side), just an absence of
            invitation.
          */}
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {links.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="opacity-70 hover:opacity-100"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <p className="text-xs opacity-60">
              © {new Date().getFullYear()} {name}
            </p>
          </div>
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
