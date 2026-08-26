import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Exchanges a freshly-minted Firebase ID token for an httpOnly session cookie.
 *
 * The ID token itself is never stored in the browser beyond this call: an
 * httpOnly cookie cannot be read by script, which is what keeps a stray XSS
 * from lifting a staff session.
 */
export async function POST(request: NextRequest) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);

    // Reject a sign-in older than five minutes. A session cookie is long-lived,
    // so it should only ever be minted from a genuinely fresh authentication.
    const authAgeSeconds = Date.now() / 1000 - decoded.auth_time;
    if (authAgeSeconds > 5 * 60) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    // A deactivated attendant must not be able to open a new session.
    const userSnap = await adminDb.doc(paths.user(decoded.uid)).get();
    if (userSnap.exists && userSnap.get("active") === false) {
      return NextResponse.json(
        { error: "This account has been deactivated." },
        { status: 403 },
      );
    }
    if (!decoded.role) {
      return NextResponse.json(
        { error: "This account has no role assigned." },
        { status: 403 },
      );
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ ok: true, role: decoded.role });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionCookie,
      maxAge: SESSION_MAX_AGE_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 401 });
  }
}

/** Sign out — clear the cookie and revoke refresh tokens everywhere. */
export async function DELETE(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid; clearing the cookie is still the right outcome.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
