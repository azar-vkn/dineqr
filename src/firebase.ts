import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import firebaseConfig from "../firebase-applet-config.json";

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
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const functions = getFunctions(app);
