import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
} from "firebase/firestore";

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);
const LOT = "dubai-main";

async function check(label, fn, shouldSucceed) {
  try {
    await fn();
    const ok = shouldSucceed;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${label} -> allowed${ok ? "" : "  <-- SHOULD BE DENIED"}`,
    );
    return ok;
  } catch (e) {
    const denied =
      String(e).includes("permission") || String(e).includes("insufficient");
    const ok = !shouldSucceed && denied;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${label} -> denied${shouldSucceed ? "  <-- SHOULD BE ALLOWED" : ""}`,
    );
    return ok;
  }
}

const results = [];
console.log("Anonymous visitor against the LIVE project:\n");
results.push(
  await check(
    "read publicView/current",
    () => getDoc(doc(db, `lots/${LOT}/publicView/current`)),
    true,
  ),
);
results.push(
  await check("read lot profile", () => getDoc(doc(db, `lots/${LOT}`)), true),
);
results.push(
  await check(
    "read rates",
    () => getDocs(collection(db, `lots/${LOT}/rates`)),
    true,
  ),
);
results.push(
  await check(
    "read sessions (PLATE NUMBERS)",
    () => getDocs(collection(db, `lots/${LOT}/sessions`)),
    false,
  ),
);
results.push(
  await check(
    "read slots",
    () => getDocs(collection(db, `lots/${LOT}/slots`)),
    false,
  ),
);
results.push(
  await check(
    "read auditLog",
    () => getDocs(collection(db, `lots/${LOT}/auditLog`)),
    false,
  ),
);
results.push(
  await check("read users", () => getDocs(collection(db, `users`)), false),
);
results.push(
  await check(
    "write publicView (fake availability)",
    () => setDoc(doc(db, `lots/${LOT}/publicView/current`), { hacked: true }),
    false,
  ),
);
results.push(
  await check(
    "write slots",
    () => setDoc(doc(db, `lots/${LOT}/slots/a-01`), { status: "available" }),
    false,
  ),
);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
