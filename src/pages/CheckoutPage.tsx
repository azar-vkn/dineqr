import { useState, useEffect } from "react";
import { useCartStore } from "../store";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { tenantCollection } from "../lib/tenant";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle2, Smartphone } from "lucide-react";
import { sanitizeText, validateOrderItems } from "../lib/sanitize";
import { checkOrderRateLimit, formatCooldown } from "../lib/rateLimit";
import { ORDER_LIMITS, GST_MULTIPLIER } from "../lib/constants";

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Razorpay Key ID (public key — safe to expose on client)
const RAZORPAY_KEY_ID = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID as string | undefined;

// Generate a cryptographically random tracking token for secure order URLs
function generateTrackingToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function CheckoutPage() {
  const { items, getTotal, tableNumber, customerName, clearCart, setLastOrderId, orderType } = useCartStore();
  const navigate = useNavigate();
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cash">("upi");
  const [isProcessing, setIsProcessing] = useState(false);

  const total = getTotal();
  const finalAmount = Math.round(total * GST_MULTIPLIER); // subtotal + GST

  useEffect(() => {
    if (items.length === 0 && !orderPlaced) {
      navigate("/");
      return;
    }
    setLoading(false);
  }, [items, navigate, orderPlaced]);

  // ─── Cash Order (client-side Firestore write — validated by rules) ───
  const handleCashOrder = async () => {
    // Rate limit check
    const rateCheck = checkOrderRateLimit();
    if (!rateCheck.allowed) {
      toast.error(`Too many orders. Please wait ${formatCooldown(rateCheck.retryAfterMs!)}`);
      return;
    }

    setIsProcessing(true);
    try {
      const safeTableNumber = sanitizeText(tableNumber || "Unknown");
      const safeCustomerName = sanitizeText(customerName || "Guest");

      if (!safeTableNumber || safeTableNumber.length > ORDER_LIMITS.MAX_TABLE_NUMBER_LENGTH) {
        toast.error("Invalid table number. Please scan the QR code again.");
        return;
      }

      if (!validateOrderItems(items)) {
        toast.error("Your cart contains invalid items. Please clear your cart and try again.");
        return;
      }

      const recalculatedTotal = Math.round(
        items.reduce((sum, item) => sum + item.price * item.quantity, 0) * GST_MULTIPLIER
      );

      if (recalculatedTotal > ORDER_LIMITS.MAX_TOTAL) {
        toast.error("Order total exceeds maximum limit.");
        return;
      }

      // Generate a random tracking token for secure order tracking
      const trackingToken = generateTrackingToken();

      const orderData: any = {
        tableNumber: safeTableNumber,
        customerName: safeCustomerName,
        items: items.map((item) => ({
          id: item.id,
          name: sanitizeText(item.name),
          price: Math.abs(item.price),
          quantity: Math.max(1, Math.min(ORDER_LIMITS.MAX_QUANTITY_PER_ITEM, Math.floor(item.quantity))),
        })),
        total: recalculatedTotal,
        status: "pending",
        paymentStatus: "pending_collection",
        paymentMethod: "cash",
        trackingToken,
        orderType: orderType || 'dine',
        orderSource: 'customer',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        restaurantId ? tenantCollection(db, restaurantId, "orders") : collection(db, "orders"),
        orderData
      );

      setOrderPlaced(true);
      clearCart();
      setLastOrderId(docRef.id, trackingToken);
      toast.success("Order placed! Please pay at the counter.");
      navigate(`/receipt/${docRef.id}?token=${trackingToken}`);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Cash order error:", error);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Secure Razorpay Payment (via Cloud Functions) ───
  const handleRazorpayPayment = async () => {
    // Rate limit check
    const rateCheck = checkOrderRateLimit();
    if (!rateCheck.allowed) {
      toast.error(`Too many orders. Please wait ${formatCooldown(rateCheck.retryAfterMs!)}`);
      return;
    }

    if (!window.Razorpay) {
      toast.error("Payment system failed to load. Please refresh the page.");
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create Razorpay order via Cloud Function
      const createOrder = httpsCallable(functions, "createRazorpayOrder");
      const result = await createOrder({
        items: items.map((item) => ({
          id: item.id,
          quantity: Math.max(1, Math.min(ORDER_LIMITS.MAX_QUANTITY_PER_ITEM, Math.floor(item.quantity))),
        })),
        tableNumber: tableNumber || "Unknown",
        customerName: customerName || "Guest",
        orderType: orderType || "dine",
        restaurantId: restaurantId || null,
      });

      const orderData = result.data as {
        razorpayOrderId: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      // Step 2: Open Razorpay checkout with server-generated order
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.razorpayOrderId,
        name: "DineQR",
        description: `Table ${tableNumber} Order`,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Step 3: Verify payment signature via Cloud Function
          try {
            const verifyPayment = httpsCallable(functions, "verifyRazorpayPayment");
            const verifyResult = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // The server verified the payment AND created the paid order
            // itself (clients can no longer write 'paid' orders), returning
            // the new order id + its tracking token.
            const verifyData = verifyResult.data as {
              verified: boolean;
              orderId: string;
              trackingToken: string;
            };

            if (!verifyData.verified || !verifyData.orderId) {
              toast.error("Payment verification failed. Please contact staff.");
              setIsProcessing(false);
              return;
            }

            setOrderPlaced(true);
            clearCart();
            setLastOrderId(verifyData.orderId, verifyData.trackingToken);
            toast.success("Payment verified! Order placed.");
            navigate(`/receipt/${verifyData.orderId}?token=${verifyData.trackingToken}`);
          } catch (verifyError: any) {
            if (import.meta.env.DEV) console.error("Payment verification error:", verifyError);
            toast.error(
              `Payment received but verification failed. Please contact staff with Payment ID: ${response.razorpay_payment_id}`
            );
            setIsProcessing(false);
          }
        },
        prefill: {
          name: customerName || "Guest",
        },
        notes: {
          tableNumber: tableNumber || "Unknown",
        },
        theme: {
          color: "#065f46",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info("Payment cancelled.");
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response: any) => {
        if (import.meta.env.DEV) console.error("Payment failed:", response.error);
        toast.error(response.error?.description || "Payment failed. Please try again.");
        setIsProcessing(false);
      });

      razorpay.open();
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Order creation error:", error);
      toast.error("Failed to initialize payment. Please try again.");
      setIsProcessing(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-stone-800">Order Placed!</h2>
        <p className="text-stone-500 max-w-sm text-lg">
          Your delicious meal is being prepared. Taking you to the tracking page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Checkout</h1>
        <span className="font-medium text-stone-500">
          Total: <span className="text-emerald-700 font-bold">₹{finalAmount}</span>
        </span>
      </div>

      <div className="flex gap-4 p-1 bg-stone-100 rounded-xl">
        <button
          onClick={() => setPaymentMethod("upi")}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${
            paymentMethod === "upi" ? "bg-white shadow-sm text-emerald-800" : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Pay Online
        </button>
        <button
          onClick={() => setPaymentMethod("cash")}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${
            paymentMethod === "cash" ? "bg-white shadow-sm text-emerald-800" : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Pay with Cash
        </button>
      </div>

      {paymentMethod === "cash" ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center space-y-3">
            <span className="text-4xl block mb-2">💵</span>
            <h3 className="font-bold text-lg">Offline Payment Selected</h3>
            <p className="text-sm font-medium">Please go to the cashier for offline payment.</p>
            <p className="text-xs opacity-80 mt-2">
              Your order will be sent to the kitchen immediately, but you must pay at the counter.
            </p>
          </div>
          <button
            onClick={handleCashOrder}
            disabled={isProcessing}
            className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Place Order Now
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
              <p className="text-stone-500">Initializing secure payment...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg">Secure Online Payment</h3>
                <p className="text-sm text-stone-500">
                  Pay securely using UPI, Cards, Wallets, or Net Banking via Razorpay.
                </p>
              </div>

              <button
                onClick={handleRazorpayPayment}
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Initiating Payment...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-5 h-5" />
                    Pay ₹{finalAmount}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
