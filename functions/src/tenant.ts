// ── Multi-tenant provisioning (Phase 3) ───────────────────────
// Callable functions that create restaurants and stamp custom claims. These
// are ADDITIVE and platform-admin gated — they don't affect the existing
// single-tenant flow until the rest of Phase 3 lands.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const app = admin.apps.length ? admin.app() : admin.initializeApp();
const FIRESTORE_DB_ID = "ai-studio-59943d32-4256-4962-9722-8ed736fd2e8e";
const db = getFirestore(app, FIRESTORE_DB_ID);

type Role = "admin" | "staff" | "cook";
const VALID_ROLES: Role[] = ["admin", "staff", "cook"];

function requirePlatformAdmin(request: { auth?: { token?: Record<string, unknown> } }): void {
  if (request.auth?.token?.platformAdmin !== true) {
    throw new HttpsError("permission-denied", "Platform-admin access required.");
  }
}

// ─────────────────────────────────────────────
// Bootstrap: the provider account claims platform-admin for itself.
// Gated to a single configured email (PLATFORM_ADMIN_EMAIL) so it can't be
// abused. Run once, then refresh the ID token client-side.
// ─────────────────────────────────────────────
export const claimPlatformAdmin = onCall(async (request) => {
  const callerEmail = request.auth?.token?.email as string | undefined;
  const allowed = process.env.PLATFORM_ADMIN_EMAIL;
  if (!request.auth || !callerEmail) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
  if (!allowed || callerEmail.toLowerCase() !== allowed.toLowerCase()) {
    throw new HttpsError("permission-denied", "Not authorized.");
  }
  await getAuth(app).setCustomUserClaims(request.auth.uid, { platformAdmin: true });
  logger.info("Platform admin bootstrapped", { uid: request.auth.uid });
  return { ok: true, note: "Refresh your ID token (getIdToken(true)) to apply." };
});

// ─────────────────────────────────────────────
// Create a restaurant (tenant). Platform-admin only.
// ─────────────────────────────────────────────
export const createRestaurant = onCall(async (request) => {
  requirePlatformAdmin(request);
  const { name, gstRate, address, timezone } = request.data || {};
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Restaurant name is required.");
  }

  const ref = db.collection("restaurants").doc();
  const rate = Number(gstRate);
  await ref.set({
    name: name.trim().slice(0, 120),
    address: typeof address === "string" ? address.slice(0, 300) : "",
    gstRate: Number.isFinite(rate) ? rate : 5,
    timezone: typeof timezone === "string" ? timezone : "Asia/Kolkata",
    razorpayKeyId: null,
    status: "active",
    subscription: { plan: "trial", status: "active" },
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info("Restaurant created", { restaurantId: ref.id });
  return { restaurantId: ref.id };
});

// ─────────────────────────────────────────────
// Assign an existing user to a restaurant with a role (stamps custom claims).
// Allowed for platform admins, or an admin of that same restaurant.
// ─────────────────────────────────────────────
export const assignUserToRestaurant = onCall(async (request) => {
  const token = request.auth?.token as Record<string, unknown> | undefined;
  const { email, restaurantId, role } = request.data || {};

  if (typeof email !== "string" || typeof restaurantId !== "string") {
    throw new HttpsError("invalid-argument", "email and restaurantId are required.");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }

  const isPlatformAdmin = token?.platformAdmin === true;
  const isRestaurantAdmin = token?.restaurantId === restaurantId && token?.role === "admin";
  if (!isPlatformAdmin && !isRestaurantAdmin) {
    throw new HttpsError("permission-denied", "Not allowed to manage this restaurant.");
  }

  const restaurantSnap = await db.collection("restaurants").doc(restaurantId).get();
  if (!restaurantSnap.exists) {
    throw new HttpsError("not-found", "Restaurant does not exist.");
  }

  let user;
  try {
    user = await getAuth(app).getUserByEmail(email.toLowerCase().trim());
  } catch {
    throw new HttpsError(
      "failed-precondition",
      "That user has not signed in yet. Ask them to sign in once, then retry."
    );
  }

  await getAuth(app).setCustomUserClaims(user.uid, { restaurantId, role });

  // Membership doc for listing staff in the admin UI.
  await db.doc(`restaurants/${restaurantId}/staff/${user.uid}`).set({
    uid: user.uid,
    email: user.email || email,
    displayName: user.displayName || "",
    role,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info("User assigned to restaurant", { uid: user.uid, restaurantId, role });
  return { uid: user.uid, note: "User must refresh their ID token to apply the new role." };
});

// ─────────────────────────────────────────────
// Set a restaurant's own Razorpay credentials.
// Public key id goes on the tenant doc; the secret goes in the locked
// restaurants/{rid}/private/razorpay doc (Admin-SDK only, clients denied).
// ─────────────────────────────────────────────
export const setRestaurantRazorpay = onCall(async (request) => {
  const token = request.auth?.token as Record<string, unknown> | undefined;
  const { restaurantId, keyId, keySecret } = request.data || {};

  if (
    typeof restaurantId !== "string" ||
    typeof keyId !== "string" ||
    typeof keySecret !== "string" ||
    keyId.length === 0 ||
    keySecret.length === 0
  ) {
    throw new HttpsError("invalid-argument", "restaurantId, keyId and keySecret are required.");
  }

  const isPlatformAdmin = token?.platformAdmin === true;
  const isRestaurantAdmin = token?.restaurantId === restaurantId && token?.role === "admin";
  if (!isPlatformAdmin && !isRestaurantAdmin) {
    throw new HttpsError("permission-denied", "Not allowed to manage this restaurant.");
  }

  const restSnap = await db.collection("restaurants").doc(restaurantId).get();
  if (!restSnap.exists) {
    throw new HttpsError("not-found", "Restaurant does not exist.");
  }

  await db.doc(`restaurants/${restaurantId}`).set({ razorpayKeyId: keyId }, { merge: true });
  await db.doc(`restaurants/${restaurantId}/private/razorpay`).set(
    { keyId, keySecret, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  logger.info("Razorpay creds set for restaurant", { restaurantId });
  return { ok: true };
});
