import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

import { pickMessages } from "@/i18n/messages";
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile } from "@/lib/data/lot";
import { Link } from "@/i18n/navigation";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The real gate. `proxy.ts` only checked that a cookie exists; this verifies
  // it, and catches a revoked or deactivated account mid-shift.
  const user = await getCurrentUser();
  if (!user) redirect("/admin");

  const t = await getTranslations("staff");
  const lot = await getLotProfile(DEFAULT_LOT_ID).catch(() => null);
  const messages = await pickMessages([
    "staff",
    "common",
    "errors",
    "receipt",
    "owner",
  ]);

  const items: NavItem[] = [
    { href: "/staff", label: t("dashboard"), icon: "dashboard" },
    { href: "/staff/in", label: t("vehicleIn"), icon: "vehicles" },
    { href: "/staff/out", label: t("vehicleOut"), icon: "search" },
    { href: "/staff/map", label: t("lotMap"), icon: "map" },
    { href: "/staff/shift", label: t("myShift"), icon: "shift" },
  ];

  return (
    <NextIntlClientProvider messages={messages}>
      <ConsoleShell
        items={items}
        title={lot?.name ?? "Parking"}
        subtitle={t("entryStation")}
        userName={user.displayName || user.email}
        headerRight={
          <>
            <span className="bg-accent-soft text-free hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex">
              <CircleCheck className="size-3.5" />
              {t("systemOnline")}
            </span>
            {user.role === "owner" && (
              <Link
                href="/owner"
                className="text-muted hover:text-text text-sm font-medium"
              >
                Owner
              </Link>
            )}
            <SignOutButton />
          </>
        }
      >
        {children}
      </ConsoleShell>
    </NextIntlClientProvider>
  );
}
