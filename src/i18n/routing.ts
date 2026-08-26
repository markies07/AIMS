import { defineRouting } from "next-intl/routing";

/**
 * §9 asks whether the public site should be English and Arabic. The answer for
 * v1 is English, but the structure is built for Arabic now because retrofitting
 * RTL later is far more expensive than planning for it.
 *
 * To add Arabic, three things are needed and nothing else:
 *   1. add "ar" to `locales` below,
 *   2. add `messages/ar.json`,
 *   3. nothing in the components — they already use logical properties
 *      (ms-/me-/ps-/pe-/text-start) and read `dir` from the layout.
 */
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

/** Locales that read right to left. */
const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

export function directionOf(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
