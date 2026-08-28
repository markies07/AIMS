/**
 * Firebase Admin connectivity check.
 *
 * Answers one question: can this environment actually reach Firestore with the
 * credentials it has? Run it locally before a deploy, or against a pulled
 * production env file, so a missing service account surfaces here instead of as
 * "Availability is temporarily unavailable" on the live site.
 *
 *   node scripts/checkDb.mjs
 *
 * Environment is loaded exactly the way `next build` loads it, so a key that
 * works here works in the app.
 */

import nextEnv from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const lotId = process.env.NEXT_PUBLIC_DEFAULT_LOT_ID ?? "dubai-main";

const missing = [
  ["FIREBASE_PROJECT_ID", projectId],
  ["FIREBASE_CLIENT_EMAIL", clientEmail],
  ["FIREBASE_PRIVATE_KEY", privateKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`FAIL  missing credentials: ${missing.join(", ")}`);
  process.exit(1);
}

// Vercel stores the PEM with literal \n sequences; a value pasted with real
// newlines but no surrounding quotes gets truncated at the first line, which
// looks like a valid key right up until the SDK rejects it.
const pem = privateKey.replace(/\n/g, "\n").trim();
if (
  !pem.startsWith("-----BEGIN PRIVATE KEY-----") ||
  !pem.endsWith("-----END PRIVATE KEY-----")
) {
  console.error(
    "FAIL  FIREBASE_PRIVATE_KEY is not a complete PEM block. It must start " +
      'with -----BEGIN PRIVATE KEY----- and end with -----END PRIVATE KEY-----.\n' +
      "      In a .env file the whole key must be wrapped in double quotes.",
  );
  process.exit(1);
}

if (projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  console.warn(
    `WARN  FIREBASE_PROJECT_ID (${projectId}) differs from ` +
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID (${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}). ` +
      "The browser and the server would be talking to different projects.",
  );
}

try {
  const app = initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey: pem }) },
    "checkDb",
  );
  const db = getFirestore(app);

  const [lot, view, rates] = await Promise.all([
    db.doc(`lots/${lotId}`).get(),
    db.doc(`lots/${lotId}/publicView/current`).get(),
    db.collection(`lots/${lotId}/rates`).limit(1).get(),
  ]);

  console.log(`OK    authenticated to Firestore as ${clientEmail}`);
  console.log(`      project           ${projectId}`);
  console.log(`      lot               ${lotId} ${lot.exists ? "found" : "MISSING"}`);
  console.log(`      publicView/current ${view.exists ? "found" : "MISSING"}`);
  console.log(`      rates             ${rates.empty ? "MISSING" : "found"}`);

  const seeded = lot.exists && view.exists && !rates.empty;
  if (!seeded) {
    console.error("\nFAIL  connected, but this lot is not seeded. Run: npm run seed");
    process.exit(1);
  }
  process.exit(0);
} catch (error) {
  console.error(`FAIL  ${error.code ?? ""} ${error.message}`);
  process.exit(1);
}
