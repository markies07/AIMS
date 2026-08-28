import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Headers applied to every response.
 *
 * This app handles plate numbers and payment records — personal data under §9 —
 * behind a session cookie, so the browser-side hardening matters as much as the
 * server-side authorisation in src/lib/auth/session.ts.
 *
 * No Content-Security-Policy is set here deliberately: a correct one needs
 * per-request nonces threaded through the proxy, and a half-correct one that
 * blocks the Firebase Auth SDK would take sign-in down. The headers below are
 * the ones that are unambiguously safe to state statically.
 */
const securityHeaders = [
  // Clickjacking. A receipt or the exit screen inside someone else's iframe is
  // how an attendant gets tricked into confirming a checkout they cannot see.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop the browser second-guessing our Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak a receipt URL (which contains a session id) to a third-party
  // origin in the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in this app uses these; deny them so a compromised script cannot.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Vercel terminates TLS and sets this too, but stating it keeps the guarantee
  // with the app rather than with the platform.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],

  // Advertising the framework and version helps nobody but a scanner.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The console and the receipt are per-user and must never be held in a
      // shared cache. `dynamic = "force-dynamic"` stops Next caching them; this
      // stops everything between Vercel and the attendant's browser.
      {
        source: "/:locale/(staff|owner|receipt)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
