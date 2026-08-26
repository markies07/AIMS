import "server-only";

import { cookies } from "next/headers";
import { adminAuth } from "../firebase/admin";
import type { Role } from "../types";

export const SESSION_COOKIE = "parking_session";

/** Firebase caps session cookies at 14 days. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export interface AuthedUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  lotIds: string[];
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "forbidden",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Resolves the caller from the session cookie, or null.
 *
 * `checkRevoked: true` costs a lookup but means a disabled or signed-out staff
 * account stops working immediately rather than at cookie expiry — which
 * matters when someone leaves mid-shift.
 */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const claims = await adminAuth.verifySessionCookie(cookie, true);
    const role = claims.role as Role | undefined;
    if (!role) return null;

    return {
      uid: claims.uid,
      email: claims.email ?? "",
      displayName: (claims.name as string) ?? claims.email ?? "",
      role,
      lotIds: Array.isArray(claims.lotIds) ? (claims.lotIds as string[]) : [],
    };
  } catch {
    // Expired, revoked, or tampered with — all equally "not signed in".
    return null;
  }
}

/**
 * The real gate. Middleware only checks that a cookie exists (it cannot verify
 * one in the Edge runtime), so every server action must call this.
 */
export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("You are not signed in.", "unauthenticated");
  }
  return user;
}

export async function requireOwner(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "owner") {
    throw new AuthError("Only the owner can do this.", "forbidden");
  }
  return user;
}

/** Staff of either role, scoped to a lot they actually belong to. */
export async function requireLotAccess(lotId: string): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "owner" && !user.lotIds.includes(lotId)) {
    throw new AuthError("You do not have access to this lot.", "forbidden");
  }
  return user;
}

export async function requireOwnerOfLot(lotId: string): Promise<AuthedUser> {
  const user = await requireOwner();
  if (user.lotIds.length > 0 && !user.lotIds.includes(lotId)) {
    throw new AuthError("You do not have access to this lot.", "forbidden");
  }
  return user;
}
