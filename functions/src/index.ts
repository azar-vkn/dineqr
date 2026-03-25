import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

// Fetch secrets from environment variables (will be set via Firebase Secrets)
const rzpKeyId = process.env.RAZORPAY_KEY_ID || "test_key";
const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || "test_secret";

const razorpay = new Razorpay({
  key_id: rzpKeyId,
  key_secret: rzpKeySecret,
});

export const createOrder = onCall(async (request) => {
  try {
    const { items, tableNumber } = request.data;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Cart items are required");
    }

    if (!tableNumber) {
      throw new HttpsError("invalid-argument", "Table number is required");
    }

    // Securely calculate total from DB prices
    let calculatedTotal = 0;
    const orderItems = [];

    for (const item of items) {
      const menuDoc = await db.collection("menu").doc(item.id).get();
      if (!menuDoc.exists) {
        throw new HttpsError("not-found", `Item ${item.name} not found in menu.`);
      }
      const menuData = menuDoc.data();
      if (!menuData || !menuData.available) {
        throw new HttpsError("failed-precondition", `Item ${item.name} is unavailable.`);
      }

      const itemTotal = menuData.price * item.quantity;
      calculatedTotal += itemTotal;

      orderItems.push({
        id: item.id,
        name: menuData.name, // Use DB name to prevent spoofing
        price: menuData.price, // Use DB price to prevent spoofing
        quantity: item.quantity
      });
    }

    // Add 5% tax
    const finalAmount = Math.round(calculatedTotal * 1.05);

    // Create Razorpay Order
    const rzpOrder = await razorpay.orders.create({
      amount: finalAmount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // Create Firestore Order with pending status
    const newOrderRef = await db.collection("orders").add({
      tableNumber,
      items: orderItems,
      total: finalAmount,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "upi", // default until verified
      razorpayOrderId: rzpOrder.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      orderId: newOrderRef.id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: rzpKeyId // Send the public key ID to the client
    };

  } catch (error) {
    logger.error("Error in createOrder:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Unable to create secure order.");
  }
});

export const verifyPayment = onCall(async (request) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, firestore_order_id } = request.data;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !firestore_order_id) {
      throw new HttpsError("invalid-argument", "Missing payment verification details.");
    }

    // Cryptographic signature verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", rzpKeySecret)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      logger.warn("Invalid signature attempt", { razorpay_order_id });
      throw new HttpsError("permission-denied", "Invalid payment signature.");
    }

    // Update Firestore order
    const orderRef = db.collection("orders").doc(firestore_order_id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Order not found in database.");
    }

    await orderRef.update({
      paymentStatus: "paid",
      razorpayPaymentId: razorpay_payment_id,
      // You could also fetch payment details from Razorpay here to get exact method (UPI, Card, etc)
    });

    return { success: true };

  } catch (error) {
    logger.error("Error verifying payment:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Payment verification failed.");
  }
});

// For pure cash orders (bypass Razorpay)
export const createCashOrder = onCall(async (request) => {
  try {
    const { items, tableNumber } = request.data;
    
    // ... same secure calculation as above ...
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
        quantity: item.quantity
      });
    }

    const finalAmount = Math.round(calculatedTotal * 1.05);

    const newOrderRef = await db.collection("orders").add({
      tableNumber: tableNumber || "Unknown",
      items: orderItems,
      total: finalAmount,
      status: "pending",
      paymentStatus: "pending_collection",
      paymentMethod: "cash",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { orderId: newOrderRef.id };
  } catch (error) {
    logger.error("Error creating cash order:", error);
    throw new HttpsError("internal", "Failed to create cash order.");
  }
});
