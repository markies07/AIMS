import { AuthError } from "../auth/session";

/**
 * Server actions return data, never throw across the boundary — a thrown error
 * in production is opaque to the client, and an attendant at the gate needs to
 * be told *which* thing went wrong so they know what to do next.
 *
 * `error` is a key into messages/en.json → `errors.*`, so the message the
 * attendant reads is translatable.
 */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: ActionErrorKey };

export type ActionErrorKey =
  | "slotTaken"
  | "sessionNotFound"
  | "alreadyCompleted"
  | "notSignedIn"
  | "forbidden"
  | "unexpected"
  | "plateRequired"
  | "reasonRequired"
  | "noRateConfigured"
  | "slotNotFound"
  | "invalidState";

export class ActionError extends Error {
  constructor(readonly key: ActionErrorKey) {
    super(key);
    this.name = "ActionError";
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionErrorKey): ActionResult<never> {
  return { ok: false, error };
}

/** Wraps an action body, mapping known failures onto stable keys. */
export async function runAction<T>(
  body: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return ok(await body());
  } catch (error) {
    if (error instanceof ActionError) {
      return fail(error.key);
    }
    if (error instanceof AuthError) {
      return fail(error.code === "forbidden" ? "forbidden" : "notSignedIn");
    }
    // Genuinely unexpected — log it server-side, tell the user nothing useful
    // to an attacker.
    console.error("[action] unexpected failure", error);
    return fail("unexpected");
  }
}
