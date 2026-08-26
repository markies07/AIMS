/**
 * Seeds a demo lot so the app is runnable immediately.
 *
 *   npm run seed
 *
 * Everything here is PLACEHOLDER data standing in for §10, which is still
 * unanswered: the real slot count and codes, the real rates, real opening
 * hours, and whether the business is VAT-registered. Replace via the owner
 * console once those are settled — nothing here is baked into code.
 *
 * Safe to re-run: slots are written by deterministic id, so it updates rather
 * than duplicating. It never deletes a session or a receipt.
 */

import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../src/lib/firebase/admin";
import { paths } from "../src/lib/firebase/paths";
import { aedToFils } from "../src/lib/money";
import { toPublicSlot } from "../src/lib/data/publicView";
import { rebuildPublicView } from "../src/lib/actions/publicViewTx";
import type { Slot, VehicleType } from "../src/lib/types";

const LOT_ID = process.env.NEXT_PUBLIC_DEFAULT_LOT_ID ?? "dubai-main";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "parking-owner-2026";
const ATTENDANT_EMAIL =
  process.env.SEED_ATTENDANT_EMAIL ?? "attendant@example.com";
const ATTENDANT_PASSWORD =
  process.env.SEED_ATTENDANT_PASSWORD ?? "parking-staff-2026";

interface SlotSpec {
  level: string;
  zone: string;
  section: string;
  prefix: string;
  from: number;
  to: number;
  vehicleType: VehicleType;
}

const SLOT_SPECS: SlotSpec[] = [
  {
    level: "Level 1",
    zone: "Zone A",
    section: "A",
    prefix: "A",
    from: 1,
    to: 12,
    vehicleType: "car",
  },
  {
    level: "Level 1",
    zone: "Zone A",
    section: "M",
    prefix: "M",
    from: 1,
    to: 6,
    vehicleType: "motorcycle",
  },
  {
    level: "Level 2",
    zone: "Zone B",
    section: "B",
    prefix: "B",
    from: 1,
    to: 12,
    vehicleType: "car",
  },
  {
    level: "Level 2",
    zone: "Zone B",
    section: "N",
    prefix: "N",
    from: 1,
    to: 4,
    vehicleType: "motorcycle",
  },
];

async function seedLot() {
  await adminDb.doc(paths.lot(LOT_ID)).set(
    {
      name: "Dubai Parking",
      address: "Placeholder address, Dubai, UAE",
      timeZone: "Asia/Dubai",
      currency: "AED",
      open24: true,
      opensAt: null,
      closesAt: null,
    },
    { merge: true },
  );
  console.log(`  lot "${LOT_ID}" written`);
}

async function seedRate() {
  const ref = adminDb.doc(paths.rate(LOT_ID, "v1"));
  if ((await ref.get()).exists) {
    console.log("  rate v1 already exists, left alone");
    return;
  }

  // The example table from §6. NOT the owner's real prices.
  await ref.set({
    effectiveFrom: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
    car: {
      firstHourFils: aedToFils(5),
      subsequentHourFils: aedToFils(3),
      graceMinutes: 15,
      dailyMaxFils: aedToFils(40),
    },
    motorcycle: {
      firstHourFils: aedToFils(3),
      subsequentHourFils: aedToFils(2),
      graceMinutes: 15,
      dailyMaxFils: aedToFils(25),
    },
    vat: {
      // §10 Q10 unanswered — assume not registered until told otherwise.
      registered: false,
      ratePercent: 5,
      pricesIncludeVat: false,
    },
  });
  console.log("  rate v1 written (placeholder rates from §6)");
}

async function seedSlots(): Promise<Slot[]> {
  const batch = adminDb.batch();
  const slots: Slot[] = [];
  let sortOrder = 0;

  for (const spec of SLOT_SPECS) {
    for (let n = spec.from; n <= spec.to; n++) {
      const code = `${spec.prefix}-${String(n).padStart(2, "0")}`;
      const id = code.toLowerCase();
      const slot: Slot = {
        id,
        code,
        level: spec.level,
        zone: spec.zone,
        section: spec.section,
        vehicleType: spec.vehicleType,
        status: "available",
        currentSessionId: null,
        outOfServiceReason: null,
        sortOrder: sortOrder++,
      };
      slots.push(slot);

      // `merge` so re-running never clobbers a slot that is currently occupied.
      batch.set(
        adminDb.doc(paths.slot(LOT_ID, id)),
        {
          code: slot.code,
          level: slot.level,
          zone: slot.zone,
          section: slot.section,
          vehicleType: slot.vehicleType,
          sortOrder: slot.sortOrder,
        },
        { merge: true },
      );
    }
  }

  await batch.commit();
  console.log(`  ${slots.length} slots written`);
  return slots;
}

/** Any slot that has never been written needs a starting status. */
async function initialiseSlotStatuses() {
  const snap = await adminDb.collection(paths.slots(LOT_ID)).get();
  const batch = adminDb.batch();
  let count = 0;

  for (const doc of snap.docs) {
    if (!doc.get("status")) {
      batch.set(
        doc.ref,
        {
          status: "available",
          currentSessionId: null,
          outOfServiceReason: null,
        },
        { merge: true },
      );
      count++;
    }
  }

  if (count) await batch.commit();
  return snap.docs.length;
}

async function seedUser(
  email: string,
  password: string,
  displayName: string,
  role: "owner" | "attendant",
) {
  let uid: string;

  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`  ${role} ${email} already exists`);
  } catch {
    const created = await adminAuth.createUser({
      email,
      password,
      displayName,
    });
    uid = created.uid;
    console.log(`  ${role} ${email} created`);
  }

  // Role lives in a custom claim, so it is carried inside the signed session
  // cookie and cannot be forged by the client.
  await adminAuth.setCustomUserClaims(uid, { role, lotIds: [LOT_ID] });

  await adminDb
    .doc(paths.user(uid))
    .set(
      { email, displayName, role, lotIds: [LOT_ID], active: true },
      { merge: true },
    );

  return uid;
}

async function main() {
  const target = process.env.FIRESTORE_EMULATOR_HOST
    ? `emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`
    : `project ${process.env.FIREBASE_PROJECT_ID}`;
  console.log(`Seeding ${target}\n`);

  await seedLot();
  await seedRate();
  const slots = await seedSlots();
  const total = await initialiseSlotStatuses();

  // Read back so the projection reflects real current statuses, not the
  // all-available assumption above — re-running against a live lot must not
  // report occupied slots as free.
  const liveSnap = await adminDb
    .collection(paths.slots(LOT_ID))
    .orderBy("sortOrder")
    .get();
  const liveSlots = liveSnap.docs.map((d) => ({
    ...(d.data() as Omit<Slot, "id">),
    id: d.id,
    status: d.get("status") ?? "available",
  })) as Slot[];

  await rebuildPublicView({
    lotId: LOT_ID,
    lotName: "Dubai Parking",
    timeZone: "Asia/Dubai",
    slots: liveSlots.map(toPublicSlot),
  });
  console.log(`  public view rebuilt from ${total} slots`);

  await adminDb
    .doc(paths.receiptCounter(LOT_ID))
    .set({ seq: 0 }, { merge: true });

  console.log("");
  await seedUser(OWNER_EMAIL, OWNER_PASSWORD, "Lot Owner", "owner");
  await seedUser(
    ATTENDANT_EMAIL,
    ATTENDANT_PASSWORD,
    "Gate Attendant",
    "attendant",
  );

  console.log(`
Done. ${slots.length} slots across ${new Set(SLOT_SPECS.map((s) => s.level)).size} levels.

Sign in at /login with:
  owner      ${OWNER_EMAIL} / ${OWNER_PASSWORD}
  attendant  ${ATTENDANT_EMAIL} / ${ATTENDANT_PASSWORD}

Change both passwords before this is exposed to the internet.
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  });
