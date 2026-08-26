import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const SESSION_COOKIE = "parking_session";

const PROTECTED = ["/staff", "/owner", "/receipt"];

/**
 * Two jobs: locale resolution, and bouncing signed-out visitors away from staff
 * routes before they see a flash of the console.
 *
 * This is a routing convenience ONLY. It checks that a cookie is *present*, not
 * that it is *valid* — the Edge runtime cannot verify a Firebase session cookie.
 * The real authorisation check is `requireUser()` / `requireOwner()` inside
 * every server action and page. Never rely on this file for security.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathWithoutLocale = stripLocale(pathname);
  const isProtected = PROTECTED.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`),
  );

  if (isProtected && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname;
}

export const config = {
  // Everything except Next internals, the auth API, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
