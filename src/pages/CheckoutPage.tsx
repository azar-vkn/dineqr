import { useState, useEffect } from "react";
import { useCartStore } from "../store";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle2, QrCode, Smartphone } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { QRCodeSVG } from "qrcode.react";
import { sanitizeText, validateOrderItems } from "../lib/sanitize";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function CheckoutPage() {
  const { items, getTotal, tableNumber, customerName, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cash">("online");
  const [isProcessingCash, setIsProcessingCash] = useState(false);
  const [isProcessingOnline, setIsProcessingOnline] = useState(false);

  const total = getTotal();
  const finalAmount = Math.round(total * 1.05); // Including 5% tax

  useEffect(() => {
    if (items.length === 0 && !orderPlaced) {
      navigate("/");
      return;
    }
    setLoading(false);
  }, [items, navigate, orderPlaced]);

  const handlePaymentSuccess = async (method: "paid" | "pending_collection" = "paid", paymentId?: string) => {
    // --- STRICT FRONTEND VALIDATION ---
    const safeTableNumber = sanitizeText(tableNumber || "Unknown");
    const safeCustomerName = sanitizeText(customerName || "Guest");

    if (!safeTableNumber || safeTableNumber.length > 20) {
      toast.error("Invalid table number. Please scan the QR code again.");
      return;
    }

    if (!validateOrderItems(items)) {
      toast.error("Your cart contains invalid items. Please clear your cart and try again.");
      return;
    }

    // Recalculate total from actual item data to prevent local manipulation
    const recalculatedTotal = Math.round(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.05
    );

    try {
      const docRef = await addDoc(collection(db, "orders"), {
        tableNumber: safeTableNumber,
        customerName: safeCustomerName,
        items: items.map(item => ({
          id: item.id,
          name: sanitizeText(item.name),
          price: Math.abs(item.price),
          quantity: Math.max(1, Math.min(50, Math.floor(item.quantity)))
        })),
        total: recalculatedTotal,
        status: "pending",
        paymentStatus: method,
        paymentMethod: method === "pending_collection" ? "cash" : "online",
        ...(paymentId ? { paymentId } : {}),
        createdAt: serverTimestamp()
      });

      setOrderPlaced(true);
      clearCart();
      toast.success("Order placed successfully!");
      navigate(`/order/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orders");
    }
  };

  const handleCashOrder = async () => {
    setIsProcessingCash(true);
    try {
      await handlePaymentSuccess("pending_collection");
    } finally {
      setIsProcessingCash(false);
    }
  };

  const handleOnlinePayment = async () => {
    setIsProcessingOnline(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount, currency: "INR" })
      });

      if (!response.ok) throw new Error("Failed to create order");
      
      const order = await response.json();

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "DineQR",
        description: `Order for Table ${tableNumber}`,
        order_id: order.id,
        handler: async function (paymentRes: any) {
          try {
            const verifyResponse = await fetch(`${API_BASE_URL}/api/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentRes)
            });
            
            const verifyData = await verifyResponse.json();
            if (verifyData.success) {
              await handlePaymentSuccess("paid", paymentRes.razorpay_payment_id);
            } else {
              toast.error("Payment verification failed. Please contact staff.");
            }
          } catch (err) {
            console.error(err);
            toast.error("Error verifying payment.");
          }
        },
        prefill: {
          name: customerName || "Guest",
          email: "guest@example.com",
          contact: "9999999999"
        },
        theme: {
          color: "#059669"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (failRes: any) {
        toast.error(`Payment Failed: ${failRes.error.description}`);
      });
      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Could not initiate payment. Please try again.");
    } finally {
      setIsProcessingOnline(false);
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
        <span className="font-medium text-stone-500">Total: <span className="text-emerald-700 font-bold">₹{finalAmount}</span></span>
      </div>

      <div className="flex gap-4 p-1 bg-stone-100 rounded-xl">
        <button 
          onClick={() => setPaymentMethod("online")}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${paymentMethod === "online" ? "bg-white shadow-sm text-emerald-800" : "text-stone-500 hover:text-stone-700"}`}
        >
          Pay Online
        </button>
        <button 
          onClick={() => setPaymentMethod("cash")}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${paymentMethod === "cash" ? "bg-white shadow-sm text-emerald-800" : "text-stone-500 hover:text-stone-700"}`}
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
            <p className="text-xs opacity-80 mt-2">Your order will be sent to the kitchen immediately, but you must pay at the counter.</p>
          </div>
          <button
            onClick={handleCashOrder}
            disabled={isProcessingCash}
            className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessingCash ? (
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
          {isProcessingOnline || loading ? (
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
                <h3 className="font-bold text-lg">Online Payment</h3>
                <p className="text-sm text-stone-500">Pay securely using UPI, Cards, Wallets, or NetBanking.</p>
              </div>

              <button
                onClick={handleOnlinePayment}
                className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" /> Pay ₹{finalAmount} Online
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
