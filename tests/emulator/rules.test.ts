import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

/**
 * Security rules tests.
 *
 * Requires the Firestore emulator:
 *   npm run emulators          (needs Java installed)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test
 *
 * Skipped otherwise rather than failing, so the unit suite still runs on a
 * machine without Java.
 *
 * The negative cases matter most here. A rule that lets the right person in is
 * pleasant; a rule that keeps plate numbers away from anonymous visitors is the
 * one that must never silently regress.
 */
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const LOT = "dubai-main";

describe.runIf(EMULATOR)("firestore.rules", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = (EMULATOR ?? "127.0.0.1:8080").split(":");
    env = await initializeTestEnvironment({
      projectId: "parking-rules-test",
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
      },
    });

    // Seed through a context that bypasses rules.
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `lots/${LOT}`), { name: "Dubai Parking" });
      await setDoc(doc(db, `lots/${LOT}/publicView/current`), {
        freeByType: { car: 5, motorcycle: 2 },
      });
      await setDoc(doc(db, `lots/${LOT}/rates/v1`), { car: {} });
      await setDoc(doc(db, `lots/${LOT}/slots/a-01`), { code: "A-01" });
      await setDoc(doc(db, `lots/${LOT}/sessions/s1`), {
        plate: { normalized: "dubaia12345" },
      });
      await setDoc(doc(db, `lots/${LOT}/auditLog/e1`), {
        action: "vehicle_in",
      });
      await setDoc(doc(db, `lots/${LOT}/counters/receipt`), { seq: 7 });
      await setDoc(doc(db, `users/attendant-1`), { role: "attendant" });
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  describe("anonymous drivers", () => {
    it("can read the public availability document", async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(db, `lots/${LOT}/publicView/current`)));
    });

    it("can read the lot profile and the rates page", async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(db, `lots/${LOT}`)));
      await assertSucceeds(getDoc(doc(db, `lots/${LOT}/rates/v1`)));
    });

    it("CANNOT read sessions — these hold plate numbers", async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, `lots/${LOT}/sessions/s1`)));
      await assertFails(getDocs(collection(db, `lots/${LOT}/sessions`)));
    });

    it("CANNOT read slots, turnaways, the audit log or counters", async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, `lots/${LOT}/slots/a-01`)));
      await assertFails(getDocs(collection(db, `lots/${LOT}/turnaways`)));
      await assertFails(getDoc(doc(db, `lots/${LOT}/auditLog/e1`)));
      await assertFails(getDoc(doc(db, `lots/${LOT}/counters/receipt`)));
    });

    it("CANNOT write the public view to fake availability", async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(db, `lots/${LOT}/publicView/current`), {
          freeByType: { car: 999, motorcycle: 999 },
        }),
      );
    });
  });

  describe("attendants", () => {
    const claims = { role: "attendant", lotIds: [LOT] };

    it("can read sessions and slots for their own lot", async () => {
      const db = env.authenticatedContext("attendant-1", claims).firestore();
      await assertSucceeds(getDoc(doc(db, `lots/${LOT}/sessions/s1`)));
      await assertSucceeds(getDoc(doc(db, `lots/${LOT}/slots/a-01`)));
    });

    it("CANNOT read a lot they are not assigned to", async () => {
      const db = env
        .authenticatedContext("attendant-2", {
          role: "attendant",
          lotIds: ["other"],
        })
        .firestore();
      await assertFails(getDoc(doc(db, `lots/${LOT}/sessions/s1`)));
    });

    it("CANNOT read the audit log — that is the owner's oversight of them", async () => {
      const db = env.authenticatedContext("attendant-1", claims).firestore();
      await assertFails(getDoc(doc(db, `lots/${LOT}/auditLog/e1`)));
    });

    it("CANNOT write anything, even to their own lot", async () => {
      const db = env.authenticatedContext("attendant-1", claims).firestore();
      // Every mutation goes through a server action; the client never writes.
      await assertFails(
        setDoc(doc(db, `lots/${LOT}/slots/a-01`), { status: "available" }),
      );
      await assertFails(
        setDoc(doc(db, `lots/${LOT}/sessions/s1`), { status: "completed" }),
      );
    });

    it("CANNOT grant themselves a role by writing the users collection", async () => {
      const db = env.authenticatedContext("attendant-1", claims).firestore();
      await assertFails(
        setDoc(doc(db, `users/attendant-1`), { role: "owner" }),
      );
    });
  });

  describe("owner", () => {
    const claims = { role: "owner", lotIds: [LOT] };

    it("can read the audit log", async () => {
      const db = env.authenticatedContext("owner-1", claims).firestore();
      await assertSucceeds(getDoc(doc(db, `lots/${LOT}/auditLog/e1`)));
    });

    it("still cannot write directly — the Admin SDK is the only writer", async () => {
      const db = env.authenticatedContext("owner-1", claims).firestore();
      await assertFails(
        setDoc(doc(db, `lots/${LOT}/slots/a-01`), { status: "out_of_service" }),
      );
    });
  });
});
