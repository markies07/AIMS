"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { adminAuth, adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import { requireOwnerOfLot } from "../auth/session";
import { ActionError, runAction, type ActionResult } from "./result";

const createSchema = z.object({
  lotId: z.string().min(1),
  email: z.email(),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(["attendant", "owner"]),
});

/**
 * §7 — create an attendant account.
 *
 * The role is written as a custom claim, which travels inside the signed
 * session cookie. That is what makes it unforgeable: a client cannot promote
 * itself by editing a Firestore document, because the server reads the role
 * from the verified token, not from the database.
 *
 * A minimum of ten characters is enforced here because these accounts are
 * created for staff by someone else, and a weak shared password on a till
 * system is how the whole audit trail becomes meaningless.
 */
export async function createStaffAccount(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ uid: string }>> {
  return runAction(async () => {
    const args = createSchema.parse(input);
    const owner = await requireOwnerOfLot(args.lotId);

    const now = new Date();

    let uid: string;
    try {
      const created = await adminAuth.createUser({
        email: args.email,
        password: args.password,
        displayName: args.displayName,
      });
      uid = created.uid;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code.includes("email-already-exists")) {
        throw new ActionError("invalidState");
      }
      throw error;
    }

    await adminAuth.setCustomUserClaims(uid, {
      role: args.role,
      lotIds: [args.lotId],
    });

    await adminDb.doc(paths.user(uid)).set({
      email: args.email,
      displayName: args.displayName,
      role: args.role,
      lotIds: [args.lotId],
      active: true,
      createdAt: Timestamp.fromDate(now),
      createdByUid: owner.uid,
    });

    await adminDb.collection(paths.auditLog(args.lotId)).add({
      actorUid: owner.uid,
      actorName: owner.displayName || owner.email,
      actorRole: owner.role,
      action: "staff_created",
      target: uid,
      details: { email: args.email, role: args.role },
      at: Timestamp.fromDate(now),
    });

    revalidatePath("/", "layout");
    return { uid };
  });
}

/**
 * Deactivating disables the Auth account AND revokes existing refresh tokens,
 * so someone who leaves mid-shift loses access immediately rather than when
 * their session cookie happens to expire.
 */
export async function setStaffActive(input: {
  lotId: string;
  uid: string;
  active: boolean;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const owner = await requireOwnerOfLot(input.lotId);

    // Locking yourself out of the only owner account would need console access
    // to undo.
    if (input.uid === owner.uid && !input.active) {
      throw new ActionError("invalidState");
    }

    const now = new Date();

    await adminAuth.updateUser(input.uid, { disabled: !input.active });
    if (!input.active) {
      await adminAuth.revokeRefreshTokens(input.uid);
    }

    await adminDb
      .doc(paths.user(input.uid))
      .set({ active: input.active }, { merge: true });

    await adminDb.collection(paths.auditLog(input.lotId)).add({
      actorUid: owner.uid,
      actorName: owner.displayName || owner.email,
      actorRole: owner.role,
      action: "staff_updated",
      target: input.uid,
      details: { active: input.active },
      at: Timestamp.fromDate(now),
    });

    revalidatePath("/", "layout");
  });
}
