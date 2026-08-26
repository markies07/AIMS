/** Shared, non-secret configuration. Safe to import from client or server. */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const useEmulator =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

/**
 * The lot this deployment serves. The data model is multi-lot from day one
 * (§11 plans more locations) but v1 runs a single lot, so the public site
 * resolves it from here rather than from a URL segment.
 */
export const DEFAULT_LOT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_LOT_ID ?? "dubai-main";
