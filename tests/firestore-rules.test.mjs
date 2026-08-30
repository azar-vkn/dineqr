/**
 * Firestore multi-tenant rules tests.
 * Run against the emulator:
 *   firebase emulators:exec --only firestore "node tests/firestore-rules.test.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import {
  setDoc, doc, getDoc, getDocs, collection, addDoc, serverTimestamp,
} from "firebase/firestore";

const RULES = readFileSync("firestore.rules", "utf8");

const testEnv = await initializeTestEnvironment({
  projectId: "dineqr-rules-test",
  firestore: { rules: RULES, host: "127.0.0.1", port: 8080 },
});

const anon = testEnv.unauthenticatedContext().firestore();
const staffA = testEnv.authenticatedContext("staffA", { restaurantId: "A", role: "staff", email: "s@a.com" }).firestore();
const adminA = testEnv.authenticatedContext("adminA", { restaurantId: "A", role: "admin", email: "a@a.com" }).firestore();
const staffB = testEnv.authenticatedContext("staffB", { restaurantId: "B", role: "staff", email: "s@b.com" }).firestore();
const platform = testEnv.authenticatedContext("plat", { platformAdmin: true, email: "p@x.com" }).firestore();

// Seed data with rules bypassed.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "restaurants/A"), { name: "A", gstRate: 5, status: "active" });
  await setDoc(doc(db, "restaurants/B"), { name: "B", gstRate: 5, status: "active" });
  await setDoc(doc(db, "restaurants/A/menu/item1"), { name: "Dosa", price: 50, category: "Main Course", available: true });
  await setDoc(doc(db, "restaurants/A/orders/o1"), { tableNumber: "T1", items: [{ id: "item1" }], total: 100, status: "pending", paymentStatus: "pending_collection", createdAt: new Date(), trackingToken: "x".repeat(20) });
  await setDoc(doc(db, "restaurants/A/private/razorpay"), { keyId: "k", keySecret: "s" });
});

const cashOrder = (over = {}) => ({
  tableNumber: "T2", items: [{ id: "item1" }], total: 50, status: "pending",
  paymentStatus: "pending_collection", paymentMethod: "cash",
  createdAt: serverTimestamp(), trackingToken: "y".repeat(20), orderSource: "customer", ...over,
});

let pass = 0, fail = 0;
async function check(name, promise, shouldSucceed) {
  try {
    await (shouldSucceed ? assertSucceeds(promise) : assertFails(promise));
    console.log("  PASS:", name); pass++;
  } catch (e) {
    console.error("  FAIL:", name, "-", (e.message || e).slice(0, 120)); fail++;
  }
}

// Public menu read
await check("anon reads A menu", getDoc(doc(anon, "restaurants/A/menu/item1")), true);
// Customer cash order in A
await check("anon creates cash order in A", addDoc(collection(anon, "restaurants/A/orders"), cashOrder()), true);
// Customer canNOT forge a paid order
await check("anon CANNOT create paid order", addDoc(collection(anon, "restaurants/A/orders"), cashOrder({ paymentStatus: "paid", paymentMethod: "upi", razorpayOrderId: "order_x", razorpayPaymentId: "pay_x", verificationToken: "z".repeat(64) })), false);
// Isolation: listing orders
await check("anon CANNOT list A orders", getDocs(collection(anon, "restaurants/A/orders")), false);
await check("staffA lists A orders", getDocs(collection(staffA, "restaurants/A/orders")), true);
await check("staffA CANNOT list B orders (isolation)", getDocs(collection(staffA, "restaurants/B/orders")), false);
await check("staffB CANNOT list A orders (isolation)", getDocs(collection(staffB, "restaurants/A/orders")), false);
// Menu writes
await check("adminA writes A menu", setDoc(doc(adminA, "restaurants/A/menu/item2"), { name: "Idli", price: 30, category: "Starters", available: true }), true);
await check("adminA CANNOT write B menu (isolation)", setDoc(doc(adminA, "restaurants/B/menu/x"), { name: "X", price: 30, category: "Starters", available: true }), false);
await check("staffA CANNOT write A menu (role)", setDoc(doc(staffA, "restaurants/A/menu/item3"), { name: "V", price: 10, category: "Drinks", available: true }), false);
// Private (Razorpay secret) locked to server for everyone
await check("staffA CANNOT read A private", getDoc(doc(staffA, "restaurants/A/private/razorpay")), false);
await check("adminA CANNOT read A private", getDoc(doc(adminA, "restaurants/A/private/razorpay")), false);
await check("platform CANNOT read A private (server-only)", getDoc(doc(platform, "restaurants/A/private/razorpay")), false);
// Platform admin cross-tenant access
await check("platform lists B orders", getDocs(collection(platform, "restaurants/B/orders")), true);

await testEnv.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
