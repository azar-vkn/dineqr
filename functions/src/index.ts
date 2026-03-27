import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

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

// ─── Input Validation Helpers ─────────────────────────────────
function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/[<>]/g, "").slice(0, maxLength);
}

function isValidRazorpayId(id: unknown, prefix: string): boolean {
  if (typeof id !== "string") return false;
  return id.startsWith(prefix) && id.length >= 10 && id.length <= 60;
}

// ─── Verification Token Generator ─────────────────────────────
// Creates a HMAC token that proves the payment was verified by
// this server. The client must include this in the Firestore write,
// and Firestore rules require it for 'paid' orders.
function generateVerificationToken(
  orderId: string,
  paymentId: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`verified:${orderId}:${paymentId}`)
    .digest("hex");
}

// ─────────────────────────────────────────────
// 1. Create Razorpay Order
// ─────────────────────────────────────────────
export const createRazorpayOrder = onCall(async (request) => {
  // Rate limit
  const clientIp = request.rawRequest?.ip || "unknown";
  if (!checkRateLimit(clientIp)) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests. Please wait a minute and try again."
    );
  }

  try {
    const { items, tableNumber, customerName } = request.data || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Cart is empty.");
    }

    if (items.length > 50) {
      throw new HttpsError("invalid-argument", "Too many items in cart.");
    }

    // Calculate total from client-provided item details
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (
        !item.id ||
        !item.name ||
        typeof item.price !== "number" ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        item.quantity > 50 ||
        item.price < 0 ||
        item.price > 100000
      ) {
        throw new HttpsError("invalid-argument", `Invalid item: ${item.id}`);
      }

      calculatedTotal += item.price * item.quantity;
      validatedItems.push({
        id: String(item.id).slice(0, 50),
        name: sanitizeString(item.name, 100),
        price: Math.abs(item.price),
        quantity: Math.floor(item.quantity),
      });
    }

    // 5% tax, convert to paise (Razorpay expects integer paise)
    const finalAmountRupees = Math.round(calculatedTotal * 1.05);
    const amountInPaise = finalAmountRupees * 100;

    if (amountInPaise <= 0 || amountInPaise > 100000000) {
      throw new HttpsError("invalid-argument", "Invalid order amount.");
    }

    // Create Razorpay order via REST API
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      logger.error("Razorpay keys not configured in functions/.env");
      throw new HttpsError("internal", "Payment system not configured.");
    }

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

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: keyId,
      validatedItems: validatedItems,
      totalRupees: finalAmountRupees,
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
export const verifyRazorpayPayment = onCall(async (request) => {
  // Rate limit
  const clientIp = request.rawRequest?.ip || "unknown";
  if (!checkRateLimit(clientIp)) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests. Please wait a minute and try again."
    );
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      request.data || {};

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

    // HMAC SHA256 signature verification
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      logger.error("Razorpay key secret not configured");
      throw new HttpsError("internal", "Payment system not configured.");
    }

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

    // Generate verification token — client must include this in
    // the Firestore order write. This proves the payment was
    // verified by this server, not forged by the client.
    const verificationToken = generateVerificationToken(
      razorpay_order_id,
      razorpay_payment_id,
      keySecret
    );

    return {
      verified: true,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      verificationToken: verificationToken,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error verifying Razorpay payment:", error);
    throw new HttpsError("internal", "Payment verification failed.");
  }
});
