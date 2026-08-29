import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = admin.initializeApp();
const FIRESTORE_DB_ID = "ai-studio-59943d32-4256-4962-9722-8ed736fd2e8e";
const firestoreDb = getFirestore(app, FIRESTORE_DB_ID);

// ── Multi-tenant provisioning (Phase 3) — additive, platform-admin gated ──
export { claimPlatformAdmin, createRestaurant, assignUserToRestaurant } from "./tenant";

// ═══════════════════════════════════════════════════════════════
// DineQR Cloud Functions — Razorpay Payment Backend (Hardened)
// ═══════════════════════════════════════════════════════════════
//
// Security features:
//   - Server-side rate limiting (IP-based, in-memory)
//   - HMAC verification tokens (anti-fraud for client Firestore writes)
//   - Strict input validation & sanitization
//   - Razorpay HMAC SHA256 signature verification
//
// Flow:
//   1. Client calls createRazorpayOrder → gets Razorpay order ID
//   2. Client opens Razorpay popup, user pays
//   3. Client calls verifyRazorpayPayment → server verifies signature
//      and returns a verificationToken (HMAC proof)
//   4. Client writes order to Firestore with verificationToken
//      (Firestore rules require this field for 'paid' orders)
//   5. onOrderCreated trigger auto-generates a bill document
// ═══════════════════════════════════════════════════════════════

// ─── Server-Side Rate Limiting ────────────────────────────────
// In-memory IP-based rate limiter. Resets when Cloud Run instance
// cold-starts, but that's acceptable — it blocks sustained abuse.
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // per IP per window
const ipRequestMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRequestMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRequestMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      ipRequestMap.delete(ip);
    }
  }
}, 5 * 60_000);

// Best-effort client IP for rate limiting. On Cloud Run the socket IP in
// request.rawRequest.ip is often absent, which collapsed every caller into one
// shared "unknown" bucket — so a burst of traffic could throttle everyone.
// Prefer the real client IP from the x-forwarded-for header.
function getClientIp(req: { headers?: Record<string, unknown>; ip?: string } | undefined): string {
  const xff = req?.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).trim();
  }
  return req?.ip || "unknown";
}

// ─── Input Validation Helpers ─────────────────────────────────
function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/[<>]/g, "").slice(0, maxLength);
}

function isValidRazorpayId(id: unknown, prefix: string): boolean {
  if (typeof id !== "string") return false;
  return id.startsWith(prefix) && id.length >= 10 && id.length <= 60;
}

// ── Multi-tenant path & credential helpers (Phase 3) ──────────
// With a restaurantId, everything lives under restaurants/{rid}/…; otherwise
// fall back to the legacy top-level layout (single-tenant transition).
function menuDocPath(restaurantId: string | undefined, itemId: string): string {
  return restaurantId ? `restaurants/${restaurantId}/menu/${itemId}` : `menu/${itemId}`;
}
function pendingOrderPath(restaurantId: string | undefined, id: string): string {
  return restaurantId ? `restaurants/${restaurantId}/pendingOrders/${id}` : `pendingOrders/${id}`;
}
function ordersPath(restaurantId: string | undefined): string {
  return restaurantId ? `restaurants/${restaurantId}/orders` : "orders";
}
// Per-restaurant Razorpay creds live in restaurants/{rid}/private/razorpay
// (Admin-SDK only; clients are denied by rules). Legacy uses env vars.
async function getRazorpayCreds(
  restaurantId: string | undefined
): Promise<{ keyId: string; keySecret: string }> {
  if (restaurantId) {
    const snap = await firestoreDb.doc(`restaurants/${restaurantId}/private/razorpay`).get();
    const d = snap.data();
    if (d?.keyId && d?.keySecret) {
      return { keyId: String(d.keyId), keySecret: String(d.keySecret) };
    }
    throw new HttpsError("failed-precondition", "This restaurant hasn't set up online payments yet.");
  }
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpsError("internal", "Payment system not configured.");
  }
  return { keyId, keySecret };
}

// ─────────────────────────────────────────────
// 1. Create Razorpay Order
// ─────────────────────────────────────────────
export const createRazorpayOrder = onCall({ enforceAppCheck: false }, async (request) => {
  // Rate limit
  const clientIp = getClientIp(request.rawRequest);
  if (!checkRateLimit(clientIp)) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests. Please wait a minute and try again."
    );
  }

  try {
    const { items, tableNumber, customerName, orderType } = request.data || {};
    const rawRid = request.data?.restaurantId;
    const restaurantId: string | undefined =
      typeof rawRid === "string" && rawRid ? rawRid : undefined;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Cart is empty.");
    }

    if (items.length > 50) {
      throw new HttpsError("invalid-argument", "Too many items in cart.");
    }

    // ── Authoritative pricing ──
    // NEVER trust client-supplied prices. Look every item up in the menu
    // collection and price the order from the server's own data.
    const uniqueIds = [
      ...new Set(items.map((i: any) => String(i?.id || ""))),
    ].filter((id) => id.length > 0);
    if (uniqueIds.length === 0) {
      throw new HttpsError("invalid-argument", "Cart has no valid items.");
    }

    const menuSnaps = await firestoreDb.getAll(
      ...uniqueIds.map((id) => firestoreDb.doc(menuDocPath(restaurantId, id)))
    );
    const menuById = new Map<string, any>();
    menuSnaps.forEach((snap) => {
      if (snap.exists) menuById.set(snap.id, snap.data());
    });

    let calculatedTotal = 0;
    const validatedItems: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }> = [];

    for (const item of items) {
      const id = String(item?.id || "");
      const menuItem = menuById.get(id);
      if (!menuItem) {
        throw new HttpsError("invalid-argument", `Item unavailable: ${id}`);
      }
      if (menuItem.available === false) {
        throw new HttpsError(
          "failed-precondition",
          `Item sold out: ${menuItem.name || id}`
        );
      }
      const quantity = Math.floor(Number(item?.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 50) {
        throw new HttpsError("invalid-argument", `Invalid quantity for item: ${id}`);
      }
      const price = Number(menuItem.price);
      if (!Number.isFinite(price) || price < 0 || price > 100000) {
        throw new HttpsError("internal", `Bad price configured for item: ${id}`);
      }

      calculatedTotal += price * quantity;
      validatedItems.push({
        id: id.slice(0, 50),
        name: sanitizeString(menuItem.name, 100),
        price,
        quantity,
      });
    }

    // 5% tax, convert to paise (Razorpay expects integer paise)
    const finalAmountRupees = Math.round(calculatedTotal * 1.05);
    const amountInPaise = finalAmountRupees * 100;

    if (amountInPaise <= 0 || amountInPaise > 100000000) {
      throw new HttpsError("invalid-argument", "Invalid order amount.");
    }

    // Create Razorpay order via REST API — use the tenant's own keys.
    const { keyId, keySecret } = await getRazorpayCreds(restaurantId);

    const safeTable = sanitizeString(tableNumber, 20) || "Unknown";
    const safeName = sanitizeString(customerName, 100) || "Guest";

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `table_${safeTable.slice(0, 10)}_${Date.now()}`,
          notes: {
            tableNumber: safeTable,
            customerName: safeName,
          },
        }),
      }
    );

    if (!razorpayResponse.ok) {
      const errorBody = await razorpayResponse.text();
      logger.error("Razorpay API error:", {
        status: razorpayResponse.status,
        body: errorBody,
      });
      throw new HttpsError("internal", "Failed to create payment order.");
    }

    const razorpayOrder = await razorpayResponse.json();
    logger.info("Razorpay order created:", razorpayOrder.id);

    // Stash the server-validated order so verifyRazorpayPayment can create
    // the real order itself. Clients must never write 'paid' orders.
    await firestoreDb.doc(pendingOrderPath(restaurantId, razorpayOrder.id)).set({
      items: validatedItems,
      total: finalAmountRupees,
      tableNumber: safeTable,
      customerName: safeName,
      orderType: orderType === "parcel" ? "parcel" : "dine",
      amountPaise: amountInPaise,
      restaurantId: restaurantId || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: keyId,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error creating Razorpay order:", error);
    throw new HttpsError("internal", "Failed to create payment order.");
  }
});

// ─────────────────────────────────────────────
// 2. Verify Razorpay Payment Signature
// ─────────────────────────────────────────────
export const verifyRazorpayPayment = onCall({ enforceAppCheck: false }, async (request) => {
  // Rate limit
  const clientIp = getClientIp(request.rawRequest);
  if (!checkRateLimit(clientIp)) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests. Please wait a minute and try again."
    );
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      request.data || {};
    const rawRid = request.data?.restaurantId;
    const restaurantId: string | undefined =
      typeof rawRid === "string" && rawRid ? rawRid : undefined;

    // Validate input formats
    if (!isValidRazorpayId(razorpay_order_id, "order_")) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid order ID format."
      );
    }

    if (!isValidRazorpayId(razorpay_payment_id, "pay_")) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid payment ID format."
      );
    }

    if (
      !razorpay_signature ||
      typeof razorpay_signature !== "string" ||
      razorpay_signature.length !== 64
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid signature format."
      );
    }

    // HMAC SHA256 signature verification — use the tenant's own key secret.
    const { keySecret } = await getRazorpayCreds(restaurantId);

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      logger.error("Payment signature mismatch", {
        razorpay_order_id,
        razorpay_payment_id,
      });
      throw new HttpsError(
        "permission-denied",
        "Payment verification failed. Signature mismatch."
      );
    }

    logger.info("Payment verified:", razorpay_order_id);

    // Idempotency — if we already created the order for this payment, reuse it
    // (handles double-clicks / retried verifications).
    const existing = await firestoreDb
      .collection(ordersPath(restaurantId))
      .where("razorpayOrderId", "==", razorpay_order_id)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      return {
        verified: true,
        orderId: doc.id,
        trackingToken: doc.data().trackingToken,
      };
    }

    // Pull the server-validated cart stashed by createRazorpayOrder.
    const pendingRef = firestoreDb.doc(pendingOrderPath(restaurantId, razorpay_order_id));
    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) {
      logger.error("No pending order for verified payment", { razorpay_order_id });
      throw new HttpsError(
        "failed-precondition",
        "Order context expired. Please contact staff with your payment ID."
      );
    }
    const pending = pendingSnap.data() as any;

    // Create the PAID order server-side. The Admin SDK bypasses Firestore
    // rules, so a 'paid' order can never be forged by a client.
    const trackingToken = crypto.randomBytes(24).toString("hex");
    const orderRef = await firestoreDb.collection(ordersPath(restaurantId)).add({
      tableNumber: pending.tableNumber || "Unknown",
      customerName: pending.customerName || "Guest",
      items: pending.items || [],
      total: pending.total || 0,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "upi",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      trackingToken,
      orderType: pending.orderType === "parcel" ? "parcel" : "dine",
      orderSource: "customer",
      createdAt: FieldValue.serverTimestamp(),
    });

    await pendingRef.delete().catch(() => undefined);

    return {
      verified: true,
      orderId: orderRef.id,
      trackingToken,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error verifying Razorpay payment:", error);
    throw new HttpsError("internal", "Payment verification failed.");
  }
});

// ─────────────────────────────────────────────
// 2b. Scheduled Daily Revenue Report (23:00 IST)
// ─────────────────────────────────────────────
// Replaces the old client-side setInterval in useDailyReport, which only fired
// if an admin happened to have the dashboard open at 11 PM. Runs server-side on
// a fixed schedule and emails via the EmailJS REST API.
export const dailyRevenueReport = onSchedule(
  { schedule: "0 23 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    // "Today" in IST (the schedule fires at 23:00 IST).
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    const y = nowIst.getUTCFullYear();
    const m = nowIst.getUTCMonth();
    const d = nowIst.getUTCDate();
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // Start of the IST day expressed as a UTC instant.
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0) - IST_OFFSET_MS);

    const reportRef = firestoreDb.doc(`reports/${dateStr}`);
    const existing = await reportRef.get();
    if (existing.exists && existing.data()?.status === "sent") {
      logger.info(`Daily report already sent for ${dateStr}`);
      return;
    }

    const ordersSnap = await firestoreDb
      .collection("orders")
      .where("createdAt", ">=", startOfDay)
      .get();

    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    const itemsMap = new Map<string, number>();
    ordersSnap.forEach((docSnap) => {
      const order = docSnap.data();
      if (order.status === "cancelled") {
        cancelledCount++;
      } else {
        completedCount++;
        totalRevenue += Number(order.total) || 0;
        (order.items || []).forEach((item: any) => {
          const name = String(item?.name || "Item");
          itemsMap.set(name, (itemsMap.get(name) || 0) + (Number(item?.quantity) || 0));
        });
      }
    });

    const topItems = Array.from(itemsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const averageOrderValue =
      completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

    const stats = {
      period: dateStr,
      totalRevenue,
      totalOrders: completedCount + cancelledCount,
      completedOrders: completedCount,
      cancelledOrders: cancelledCount,
      averageOrderValue,
      topItems,
    };

    // Email via EmailJS REST API (server-side requires the private key).
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    const toEmail = process.env.REPORT_TO_EMAIL || "admin@example.com";

    if (serviceId && templateId && publicKey && privateKey) {
      const emailRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_email: toEmail,
            report_period: dateStr,
            total_revenue: `₹${totalRevenue.toLocaleString("en-IN")}`,
            total_orders: completedCount + cancelledCount,
            completed_orders: completedCount,
            cancelled_orders: cancelledCount,
            average_order: `₹${averageOrderValue.toLocaleString("en-IN")}`,
            top_items:
              topItems.map((i) => `${i.count}x ${i.name}`).join("\n") || "None",
          },
        }),
      });
      if (!emailRes.ok) {
        const body = await emailRes.text();
        logger.error("EmailJS send failed", { status: emailRes.status, body });
        await reportRef.set(
          { status: "error", error: body.slice(0, 500), stats, at: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return;
      }
    } else {
      logger.warn("EmailJS not fully configured — saving report without emailing.");
    }

    await reportRef.set(
      { status: "sent", sentAt: FieldValue.serverTimestamp(), stats },
      { merge: true }
    );
    logger.info(`Daily revenue report sent for ${dateStr}: ₹${totalRevenue}`);
  }
);

// ─────────────────────────────────────────────
// 3. Auto-Generate Bill on Order Creation
// ─────────────────────────────────────────────
// Firestore trigger — runs server-side via Admin SDK,
// so bills can never be forged by a client.
export const onOrderCreated = onDocumentCreated(
  {
    document: "orders/{orderId}",
    database: FIRESTORE_DB_ID,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("onOrderCreated: No data in event");
      return;
    }

    const orderId = event.params.orderId;
    const orderData = snapshot.data();

    try {
      // Generate sequential bill number: BILL-YYYYMMDD-XXXX
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      // Atomic counter for daily bill numbers
      const counterRef = firestoreDb.doc(`counters/bills-${dateStr}`);
      const counterResult = await firestoreDb.runTransaction(async (tx) => {
        const counterDoc = await tx.get(counterRef);
        let nextNum = 1;
        if (counterDoc.exists) {
          nextNum = (counterDoc.data()?.count || 0) + 1;
        }
        tx.set(counterRef, { count: nextNum, date: dateStr });
        return nextNum;
      });

      const billNumber = `BILL-${dateStr}-${String(counterResult).padStart(4, "0")}`;

      // Authoritative itemized breakdown — re-price from the menu so the
      // bill (the money of record) can't be skewed by a tampered client.
      const rawItems = (orderData.items || []) as any[];
      const billItemIds = [
        ...new Set(rawItems.map((i) => String(i?.id || ""))),
      ].filter((id) => id.length > 0);
      const priceById = new Map<string, { name: string; price: number }>();
      if (billItemIds.length > 0) {
        const snaps = await firestoreDb.getAll(
          ...billItemIds.map((id) => firestoreDb.doc(`menu/${id}`))
        );
        snaps.forEach((s) => {
          if (s.exists) {
            const d = s.data() as any;
            priceById.set(s.id, { name: String(d.name), price: Number(d.price) });
          }
        });
      }

      const items = rawItems.map((item: any) => {
        const authoritative = priceById.get(String(item?.id || ""));
        const unitPrice = authoritative ? authoritative.price : Number(item.price) || 0;
        const name = authoritative ? authoritative.name : String(item.name || "Unknown");
        const quantity = Number(item.quantity) || 1;
        return { name, quantity, unitPrice, subtotal: unitPrice * quantity };
      });

      const subtotal = items.reduce(
        (sum: number, item: any) => sum + item.subtotal,
        0
      );
      const gstRate = 5; // 5% GST
      const gstAmount = Math.round(subtotal * (gstRate / 100));
      const total = subtotal + gstAmount;

      const billData = {
        orderId,
        billNumber,
        tableNumber: orderData.tableNumber || "Unknown",
        customerName: orderData.customerName || "Guest",
        orderType: orderData.orderType || "dine",
        items,
        subtotal,
        gstRate,
        gstAmount,
        total,
        paymentMethod: orderData.paymentMethod || "cash",
        paymentStatus: orderData.paymentStatus || "pending_collection",
        razorpayPaymentId: orderData.razorpayPaymentId || null,
        // Carry the order's tracking token so the receipt page can gate access.
        trackingToken: orderData.trackingToken || null,
        createdAt: FieldValue.serverTimestamp(),
      };

      // Write bill doc keyed by orderId for easy lookup
      await firestoreDb.doc(`bills/${orderId}`).set(billData);

      // Keep the order's displayed total in sync with the authoritative bill.
      if (Number(orderData.total) !== total) {
        await snapshot.ref
          .update({ total })
          .catch((e) => logger.warn("Could not sync order total", { orderId, e }));
      }

      logger.info(`Bill generated: ${billNumber} for order ${orderId}`);
    } catch (error) {
      logger.error("Error generating bill:", { orderId, error });
      // Don't throw — we don't want to retry bill generation endlessly
    }
  }
);
