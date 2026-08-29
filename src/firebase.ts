import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

// ── Firebase Configuration ───────────────────────────────────
// Read from environment variables (preferred) with fallback to
// the static config file for backward compatibility with web deploys.
let firebaseConfig: Record<string, string>;

const envApiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;

if (envApiKey) {
  // Use environment variables (desktop / custom builds)
  firebaseConfig = {
    apiKey: envApiKey,
    authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "",
    firestoreDatabaseId: (import.meta as any).env?.VITE_FIREBASE_FIRESTORE_DB_ID || "(default)",
  };
} else {
  // Fallback: static JSON config (Firebase Hosting / legacy)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    firebaseConfig = (await import("../firebase-applet-config.json")).default;
  } catch {
    throw new Error(
      "[DineQR] Firebase config not found. Set VITE_FIREBASE_* env vars or provide firebase-applet-config.json"
    );
  }
}

const app = initializeApp(firebaseConfig);

// ── Firebase App Check (Bot Protection) ──────────────────────
// Protects backend resources from abuse by verifying that
// requests come from your genuine app, not scripts or bots.
const recaptchaSiteKey = (import.meta as any).env
  ?.VITE_RECAPTCHA_SITE_KEY as string | undefined;

if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.DEV) {
  // Debug mode for local development only
  // To use: set self.FIREBASE_APPCHECK_DEBUG_TOKEN = true in browser console
  console.warn(
    "[Security] App Check not configured — set VITE_RECAPTCHA_SITE_KEY in .env.local"
  );
}

// ── Exports ─────────────────────────────────────────────────
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);
export const functions = getFunctions(app);
