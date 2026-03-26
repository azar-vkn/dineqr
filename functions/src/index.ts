import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

// Razorpay keys loaded from functions/.env file
// Create functions/.env with:
//   RAZORPAY_KEY_ID=rzp_test_xxxx
//   RAZORPAY_KEY_SECRET=xxxx

// ─────────────────────────────────────────────
// 1. Create Cash Order (existing)
// ─────────────────────────────────────────────
export const createCashOrder = onCall(async (request) => {
  try {
    const { items, tableNumber, customerName } = request.data;

    let calculatedTotal = 0;
    const orderItems = [];

    for (const item of items) {
      const menuDoc = await db.collection("menu").doc(item.id).get();
      if (!menuDoc.exists) continue;
      const menuData = menuDoc.data();
      if (!menuData || !menuData.available) continue;

      calculatedTotal += menuData.price * item.quantity;
      orderItems.push({
        id: item.id,
        name: menuData.name,
        price: menuData.price,
        quantity: item.quantity,
      });
    }

    const finalAmount = Math.round(calculatedTotal * 1.05);

    const newOrderRef = await db.collection("orders").add({
      tableNumber: tableNumber || "Unknown",
      customerName: customerName || "Guest",
      items: orderItems,
      total: finalAmount,
      status: "pending",
      paymentStatus: "pending_collection",
      paymentMethod: "cash",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { orderId: newOrderRef.id };
  } catch (error) {
    logger.error("Error creating cash order:", error);
    throw new HttpsError("internal", "Failed to create cash order.");
  }
});

// ─────────────────────────────────────────────
// 2. Create Razorpay Order
// ─────────────────────────────────────────────
export const createRazorpayOrder = onCall(async (request) => {
    try {
      const { items, tableNumber, customerName } = request.data;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new HttpsError("invalid-argument", "Cart is empty.");
      }

      // Server-side price calculation from Firestore menu data
      let calculatedTotal = 0;
      const orderItems = [];

      for (const item of items) {
        if (!item.id || typeof item.quantity !== "number" || item.quantity <= 0 || item.quantity > 50) {
          throw new HttpsError("invalid-argument", `Invalid item: ${item.id}`);
        }

        const menuDoc = await db.collection("menu").doc(item.id).get();
        if (!menuDoc.exists) {
          throw new HttpsError("not-found", `Menu item ${item.id} not found.`);
        }

        const menuData = menuDoc.data();
        if (!menuData || !menuData.available) {
          throw new HttpsError("failed-precondition", `${menuData?.name || item.id} is currently unavailable.`);
        }

        calculatedTotal += menuData.price * item.quantity;
        orderItems.push({
          id: item.id,
          name: menuData.name,
          price: menuData.price,
          quantity: Math.floor(item.quantity),
        });
      }

      // 5% tax, convert to paise (Razorpay expects integer paise)
      const finalAmountRupees = Math.round(calculatedTotal * 1.05);
      const amountInPaise = finalAmountRupees * 100;

      // Create Razorpay order via REST API
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        logger.error("Razorpay keys not configured in functions/.env");
        throw new HttpsError("internal", "Payment system not configured.");
      }
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

      const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `table_${tableNumber || "unknown"}_${Date.now()}`,
          notes: {
            tableNumber: tableNumber || "Unknown",
            customerName: customerName || "Guest",
          },
        }),
      });

      if (!razorpayResponse.ok) {
        const errorBody = await razorpayResponse.text();
        logger.error("Razorpay order creation failed:", errorBody);
        throw new HttpsError("internal", "Failed to create payment order.");
      }

      const razorpayOrder = await razorpayResponse.json();

      // Store pending order data in Firestore for verification later
      await db.collection("pendingOrders").doc(razorpayOrder.id).set({
        razorpayOrderId: razorpayOrder.id,
        tableNumber: tableNumber || "Unknown",
        customerName: customerName || "Guest",
        items: orderItems,
        totalRupees: finalAmountRupees,
        amountPaise: amountInPaise,
        status: "created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
// 3. Verify Razorpay Payment
// ─────────────────────────────────────────────
export const verifyRazorpayPayment = onCall(async (request) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.data;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new HttpsError("invalid-argument", "Missing payment verification details.");
      }

      // HMAC SHA256 signature verification
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keySecret) {
        logger.error("Razorpay key secret not configured in functions/.env");
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
        throw new HttpsError("permission-denied", "Payment verification failed. Signature mismatch.");
      }

      // Retrieve the pending order data
      const pendingOrderDoc = await db.collection("pendingOrders").doc(razorpay_order_id).get();
      if (!pendingOrderDoc.exists) {
        throw new HttpsError("not-found", "Pending order not found.");
      }

      const pendingOrder = pendingOrderDoc.data()!;

      // Prevent double-processing
      if (pendingOrder.status === "completed") {
        return { orderId: pendingOrder.firestoreOrderId };
      }

      // Create the actual order in Firestore
      const newOrderRef = await db.collection("orders").add({
        tableNumber: pendingOrder.tableNumber,
        customerName: pendingOrder.customerName,
        items: pendingOrder.items,
        total: pendingOrder.totalRupees,
        status: "pending",
        paymentStatus: "paid",
        paymentMethod: "upi",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark pending order as completed
      await db.collection("pendingOrders").doc(razorpay_order_id).update({
        status: "completed",
        firestoreOrderId: newOrderRef.id,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { orderId: newOrderRef.id };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error verifying Razorpay payment:", error);
      throw new HttpsError("internal", "Payment verification failed.");
    }
});
