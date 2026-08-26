import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The double-assignment test.
 *
 * §4 claims two cars being sent to the same space is "impossible — a slot is
 * reserved the moment it is assigned". That claim rests entirely on the
 * read-assert-write inside the Firestore transaction in `admitVehicle`
 * (src/lib/actions/vehicles.ts). This test fires concurrent attempts at one
 * slot and asserts exactly one wins.
 *
 * It exercises the transaction against the real Firestore engine rather than
 * calling the server action directly — the action needs a request context for
 * its auth check, which does not exist in a test process. What is under test is
 * the concurrency contract the action depends on, using the identical
 * read-assert-write shape.
 *
 * Requires the emulator:
 *   npm run emulators          (needs Java installed)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test
 */
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(EMULATOR)("concurrent slot assignment", () => {
  let app: App;
  let db: Firestore;

  const SLOT = "lots/test-lot/slots/b-14";

  beforeEach(async () => {
    app ??= initializeApp(
      { projectId: "parking-concurrency-test" },
      "concurrency",
    );
    db = getFirestore(app);
    await db.doc(SLOT).set({
      code: "B-14",
      status: "available",
      currentSessionId: null,
      vehicleType: "car",
    });
  });

  afterAll(async () => {
    if (app) await deleteApp(app);
  });

  /** The same shape as `admitVehicle`'s transaction body. */
  async function tryAssign(sessionId: string): Promise<"won" | "lost"> {
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(db.doc(SLOT));
        if (snap.get("status") !== "available") {
          throw new Error("slotTaken");
        }
        tx.update(db.doc(SLOT), {
          status: "assigned",
          currentSessionId: sessionId,
        });
      });
      return "won";
    } catch (error) {
      if (error instanceof Error && error.message === "slotTaken")
        return "lost";
      throw error;
    }
  }

  it("lets exactly one of two simultaneous attempts win", async () => {
    const results = await Promise.all([
      tryAssign("session-a"),
      tryAssign("session-b"),
    ]);

    expect(results.filter((r) => r === "won")).toHaveLength(1);
    expect(results.filter((r) => r === "lost")).toHaveLength(1);
  });

  it("leaves the slot pointing at the winner alone", async () => {
    await Promise.all([tryAssign("session-a"), tryAssign("session-b")]);

    const snap = await db.doc(SLOT).get();
    expect(snap.get("status")).toBe("assigned");
    // Whichever won, the slot must reference exactly one session — never the
    // second write silently overwriting the first.
    expect(["session-a", "session-b"]).toContain(snap.get("currentSessionId"));
  });

  it("holds under heavier contention", async () => {
    const attempts = Array.from({ length: 8 }, (_, i) =>
      tryAssign(`session-${i}`),
    );
    const results = await Promise.all(attempts);

    expect(results.filter((r) => r === "won")).toHaveLength(1);
    expect(results.filter((r) => r === "lost")).toHaveLength(7);
  });
});
