"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { firebaseConfig, useEmulator } from "./config";

/**
 * The browser SDK. Used for exactly two things:
 *   1. signing a user in, to obtain an ID token, and
 *   2. `onSnapshot` reads for live updates.
 *
 * It never writes. Every mutation goes through a server action using the Admin
 * SDK, and the security rules deny client writes outright — see firestore.rules.
 */

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulator && typeof window !== "undefined") {
  const w = window as unknown as { __fbEmulatorsConnected?: boolean };
  if (!w.__fbEmulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    w.__fbEmulatorsConnected = true;
  }
}

export { app };
