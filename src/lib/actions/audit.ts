import "server-only";

import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { paths } from "../firebase/paths";
import type { AuthedUser } from "../auth/session";

export type AuditAction =
  | "vehicle_in"
  | "vehicle_parked"
  | "vehicle_out"
  | "assignment_cancelled"
  | "slot_reassigned"
  | "plate_corrected"
  | "slot_out_of_service"
  | "slot_returned_to_service"
  | "slot_created"
  | "slot_updated"
  | "slot_retired"
  | "turnaway_recorded"
  | "manual_entry_created"
  | "discount_applied"
  | "rate_version_created"
  | "staff_created"
  | "staff_updated";

export interface AuditDetails {
  [key: string]: string | number | boolean | null;
}

/**
 * Writes an audit entry inside the caller's transaction, so the record of a
 * change and the change itself either both land or neither does. §7 promises
 * the owner "a history of who changed what" — that promise is only worth
 * anything if it cannot be partially written.
 */
export function writeAudit(
  tx: Transaction,
  lotId: string,
  entry: {
    actor: AuthedUser;
    action: AuditAction;
    target: string;
    at: Date;
    details?: AuditDetails;
  },
): void {
  const ref = adminDb.collection(paths.auditLog(lotId)).doc();
  tx.set(ref, {
    actorUid: entry.actor.uid,
    actorName: entry.actor.displayName || entry.actor.email,
    actorRole: entry.actor.role,
    action: entry.action,
    target: entry.target,
    details: entry.details ?? {},
    at: Timestamp.fromDate(entry.at),
  });
}
