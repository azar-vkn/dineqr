#!/usr/bin/env node
/**
 * DineQR single-tenant → multi-tenant migration.
 *
 * Copies the existing top-level collections into
 * restaurants/{restaurantId}/… and (optionally) stamps the first admin's
 * custom claims so they can access the tenant.
 *
 * DRY-RUN by default (no writes). Pass --execute to actually write.
 * Originals are left in place, so this is reversible (just delete the tenant
 * subtree if something looks wrong).
 *
 * Usage (run from repo root, needs a Firebase service-account key):
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa.json \
 *     node functions/scripts/migrate-to-tenant.cjs --restaurant <rid> \
 *       [--admin-email you@example.com] [--execute]
 *   # or:  --key ./sa.json  instead of the env var
 *
 * ⚠️ IMPORTANT — bill trigger interaction:
 *   Copying `orders` fires onTenantOrderCreated, which regenerates bills under
 *   restaurants/{rid}/bills. To avoid duplicate/among-conflicting bills, run
 *   this migration BEFORE deploying the tenant functions, OR exclude "bills"
 *   below and let the trigger rebuild them after deploy. Choose one at go-live.
 */
const path = require("path");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const FIRESTORE_DB_ID = "ai-studio-59943d32-4256-4962-9722-8ed736fd2e8e";
const COLLECTIONS = [
  "menu",
  "orders",
  "bills",
  "purchases",
  "feedback",
  "menuRatings",
  "counters",
  "reports",
];

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const restaurantId = argVal("--restaurant");
const adminEmail = argVal("--admin-email");
const execute = args.includes("--execute");
const keyPath = argVal("--key") || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!restaurantId) {
  console.error(
    "Usage: node functions/scripts/migrate-to-tenant.cjs --restaurant <rid> " +
      "[--admin-email <email>] [--key <sa.json>] [--execute]"
  );
  process.exit(1);
}

admin.initializeApp(
  keyPath
    ? { credential: admin.credential.cert(require(path.resolve(keyPath))) }
    : undefined // falls back to Application Default Credentials
);
const db = getFirestore(admin.app(), FIRESTORE_DB_ID);

(async () => {
  console.log(`\n=== DineQR migration → restaurants/${restaurantId} ===`);
  console.log(execute ? "MODE: EXECUTE (will write)" : "MODE: DRY-RUN (no writes)");

  // 1) Ensure the tenant doc exists.
  const rref = db.doc(`restaurants/${restaurantId}`);
  const rsnap = await rref.get();
  console.log(`\nrestaurants/${restaurantId}: ${rsnap.exists ? "exists" : "MISSING → will create"}`);
  if (execute && !rsnap.exists) {
    await rref.set(
      {
        name: restaurantId,
        gstRate: 5,
        status: "active",
        timezone: "Asia/Kolkata",
        razorpayKeyId: null,
        subscription: { plan: "trial", status: "active" },
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("  created tenant doc");
  }

  // 2) Copy each collection into the tenant subtree.
  let grand = 0;
  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).get();
    console.log(`\n[${col}] ${snap.size} docs`);
    grand += snap.size;
    if (!execute) continue;

    let batch = db.batch();
    let n = 0;
    for (const d of snap.docs) {
      batch.set(db.doc(`restaurants/${restaurantId}/${col}/${d.id}`), d.data(), {
        merge: true,
      });
      if (++n % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
    console.log(`  copied ${snap.size} → restaurants/${restaurantId}/${col}`);
  }
  console.log(`\nTotal docs across collections: ${grand}`);

  // 3) Stamp the first admin's claims.
  if (adminEmail) {
    const auth = admin.auth(admin.app());
    try {
      const user = await auth.getUserByEmail(adminEmail.toLowerCase());
      console.log(`\nadmin ${adminEmail} (uid ${user.uid}) → { restaurantId, role: 'admin' }`);
      if (execute) {
        await auth.setCustomUserClaims(user.uid, { restaurantId, role: "admin" });
        console.log("  claims set — user must re-login / refresh their ID token");
      }
    } catch (e) {
      console.error(`  could not set claims for ${adminEmail}:`, e.message);
    }
  }

  console.log(`\n${execute ? "DONE." : "DRY-RUN complete. Re-run with --execute to apply."}\n`);
  process.exit(0);
})().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
