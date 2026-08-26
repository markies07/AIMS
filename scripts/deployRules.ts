/**
 * Publishes firestore.rules to the live project.
 *
 *   npm run rules:deploy
 *
 * Uses the service account directly rather than the Firebase CLI, which needs
 * an interactive browser login. Two API calls: create a ruleset from the local
 * file, then point the `cloud.firestore` release at it.
 *
 * Worth running before any real data exists. Firestore's default rules are
 * permissive, and firestore.rules is the only thing standing between an
 * anonymous visitor and the plate numbers in `sessions`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const RULES_FILE = "firestore.rules";

async function main() {
  if (!PROJECT) throw new Error("FIREBASE_PROJECT_ID is not set");

  const source = readFileSync(resolve(process.cwd(), RULES_FILE), "utf8");

  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  console.log(`Publishing ${RULES_FILE} to ${PROJECT}\n`);

  // 1. Create an immutable ruleset from the local file.
  const ruleset = await client.request<{ name: string }>({
    url: `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    method: "POST",
    data: {
      source: { files: [{ name: RULES_FILE, content: source }] },
    },
  });

  const rulesetName = ruleset.data.name;
  console.log(`  ruleset created: ${rulesetName}`);

  // 2. Point the live release at it. The release name is fixed by Firestore.
  //    A project that has never had rules published has no release yet, so
  //    update first and fall back to create.
  const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;

  try {
    await client.request({
      url: `https://firebaserules.googleapis.com/v1/${releaseName}`,
      method: "PATCH",
      data: { release: { name: releaseName, rulesetName } },
    });
    console.log("  release updated: cloud.firestore");
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (status !== 404) throw error;

    await client.request({
      url: `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
      method: "POST",
      data: { name: releaseName, rulesetName },
    });
    console.log("  release created: cloud.firestore");
  }
  console.log("\nRules are live.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    const detail =
      error?.response?.data?.error?.message ?? error?.message ?? error;
    console.error("\nRules deploy failed:", detail);
    process.exit(1);
  });
