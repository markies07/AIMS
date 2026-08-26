import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The Admin SDK — full, unrestricted access to the project.
 *
 * `server-only` makes importing this from a client component a build error
 * rather than a credential leak. Every write in the system happens here.
 *
 * Initialisation is LAZY. Building the app must not require production
 * credentials to be present, and a missing key should surface as a failure on
 * the one request that needed it rather than taking down the whole build — the
 * public availability page has no business going down because a service account
 * was not configured.
 */

const APP_NAME = "parking-admin";

function createApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  // Against the emulator the SDK needs no real credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp(
      {
        projectId:
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "parking-system-dev",
      },
      APP_NAME,
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (see .env.example).",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        // Vercel stores the key with literal \n sequences.
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    },
    APP_NAME,
  );
}

/**
 * Defers construction to first property access, so importing this module is
 * free. Methods are bound to the real instance so `adminDb.collection(...)`
 * behaves exactly as if it were the Firestore object itself.
 */
function lazy<T extends object>(factory: () => T): T {
  let instance: T | null = null;
  const resolve = () => (instance ??= factory());

  return new Proxy(Object.create(null) as T, {
    get(_target, prop) {
      const target = resolve() as Record<string | symbol, unknown>;
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_target, prop) {
      return prop in (resolve() as object);
    },
    getPrototypeOf() {
      return Object.getPrototypeOf(resolve());
    },
  });
}

export const adminApp = lazy<App>(createApp);
export const adminAuth = lazy<Auth>(() => getAuth(createApp()));
export const adminDb = lazy<Firestore>(() => getFirestore(createApp()));
