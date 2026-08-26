import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { directionOf, routing } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "public" });

  return {
    title: t("title"),
    description: t("parkingSpotsHint"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      // Set from the locale, so adding Arabic flips the whole UI without any
      // component changes — every layout utility used is a logical property.
      dir={directionOf(locale)}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="bg-bg text-text flex min-h-full flex-col font-sans">
        {/*
          No messages here on purpose. Each section layout provides only the
          namespaces its client components render, so the public pages never
          ship the console's strings. See src/i18n/messages.ts.
        */}
        <NextIntlClientProvider messages={{}}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
