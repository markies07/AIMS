import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

import { pickMessages } from "@/i18n/messages";
import { CircleCheck } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile } from "@/lib/data/lot";
import { Link } from "@/i18n/navigation";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin");

  // Owner-only. Every action underneath re-checks this independently — a layout
  // guard alone would not stop a direct POST to a server action.
  if (user.role !== "owner") redirect("/staff");

  const t = await getTranslations("owner");
  const lot = await getLotProfile(DEFAULT_LOT_ID).catch(() => null);
  const messages = await pickMessages([
    "owner",
    "common",
    "errors",
    "rates",
    "auth",
  ]);

  const items: NavItem[] = [
    { href: "/owner", label: t("dashboard"), icon: "dashboard" },
    { href: "/owner/slots", label: t("slots"), icon: "slots" },
    { href: "/owner/rates", label: t("rates"), icon: "rates" },
    { href: "/owner/staff", label: t("staff"), icon: "staff" },
    { href: "/owner/history", label: t("history"), icon: "reports" },
    { href: "/owner/audit", label: t("auditLog"), icon: "settings" },
  ];

  return (
    <NextIntlClientProvider messages={messages}>
      <ConsoleShell
        items={items}
        title={lot?.name ?? "Parking"}
        subtitle="Owner console"
        userName={user.displayName || user.email}
        headerRight={
          <>
            <span className="bg-accent-soft text-free hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex">
              <CircleCheck className="size-3.5" />
              System online
            </span>
            <Link
              href="/staff"
              className="text-muted hover:text-text text-sm font-medium"
            >
              Gate
            </Link>
            <SignOutButton />
          </>
        }
      >
        {children}
      </ConsoleShell>
    </NextIntlClientProvider>
  );
}
