import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// For pure cash orders
export const createCashOrder = onCall(async (request) => {
  try {
    const { items, tableNumber, customerName } = request.data;
    
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
      customerName: customerName || "Guest",
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
