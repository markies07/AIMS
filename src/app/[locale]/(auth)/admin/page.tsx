import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

import { pickMessages } from "@/i18n/messages";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

/**
 * Staff and owner sign-in.
 *
 * Lives at /admin and is not linked from anywhere on the public site —
 * attendants reach it by bookmark. That is obscurity, not security: the route
 * is still fully guarded server-side, and every action behind it re-verifies
 * the session independently. `noindex` keeps it out of search results.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages = await pickMessages(["auth", "common"]);

  return (
    <NextIntlClientProvider messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>
  );
}
