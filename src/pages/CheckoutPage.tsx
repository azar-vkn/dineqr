import { useState, useEffect } from "react";
import { useCartStore } from "../store";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle2, QrCode, Smartphone } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { QRCodeSVG } from "qrcode.react";

export default function CheckoutPage() {
  const { items, getTotal, tableNumber, customerName, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cash">("upi");
  const [isProcessingCash, setIsProcessingCash] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Replace this with your actual merchant UPI ID
  const MERCHANT_UPI_ID = "asirselvin446@oksbi";
  const MERCHANT_NAME = "ABA Agents";

  const total = getTotal();
  const finalAmount = Math.round(total * 1.05); // Including 5% tax

  const upiLink = `upi://pay?pa=${MERCHANT_UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${finalAmount}&cu=INR&tn=Order%20Table%20${tableNumber}`;

  useEffect(() => {
    if (items.length === 0 && !orderPlaced) {
      navigate("/");
      return;
    }
    setLoading(false);
  }, [items, navigate, orderPlaced]);

  const handlePaymentSuccess = async (method: "paid" | "pending_collection" = "paid") => {
    try {
      // Create order in Firestore
      const docRef = await addDoc(collection(db, "orders"), {
        tableNumber: tableNumber || "Unknown",
        customerName: customerName || "Guest",
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total: finalAmount,
        status: "pending",
        paymentStatus: method,
        paymentMethod: method === "pending_collection" ? "cash" : "upi",
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

  const handleUpiPayment = async () => {
    setShowUpiModal(true);
  };

  const confirmUpiPayment = async () => {
    setIsVerifying(true);
    try {
      // Simulate a brief verification delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      await handlePaymentSuccess("paid");
    } finally {
      setIsVerifying(false);
      setShowUpiModal(false);
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
          onClick={() => setPaymentMethod("upi")}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${paymentMethod === "upi" ? "bg-white shadow-sm text-emerald-800" : "text-stone-500 hover:text-stone-700"}`}
        >
          Pay with UPI
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
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
              <p className="text-stone-500">Initializing secure payment...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Smartphone className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg">UPI Payment</h3>
                <p className="text-sm text-stone-500">Pay securely using Google Pay, PhonePe, Paytm, or any UPI app.</p>
              </div>

              <button
                onClick={handleUpiPayment}
                className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2"
              >
                <QrCode className="w-5 h-5" /> Pay ₹{finalAmount} via UPI
              </button>
            </div>
          )}
        </div>
      )}

      {/* UPI QR Modal */}
      {showUpiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-stone-800">Scan to Pay</h3>
              <p className="text-sm text-stone-500">Table {tableNumber} • ₹{finalAmount}</p>
            </div>

            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 flex flex-col items-center justify-center space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCodeSVG value={upiLink} size={200} level="H" />
              </div>
              <div className="text-center">
                <p className="text-xs font-mono text-stone-400 uppercase tracking-widest mb-1">UPI ID</p>
                <p className="text-sm font-bold text-stone-700">{MERCHANT_UPI_ID}</p>
              </div>
              
              {/* Deep link button for mobile users */}
              <a 
                href={upiLink}
                className="w-full py-4 bg-emerald-50 border-2 border-emerald-600 text-emerald-700 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
              >
                <Smartphone className="w-5 h-5" />
                Open Payment App
              </a>
            </div>

            <div className="space-y-3">
              <button
                onClick={confirmUpiPayment}
                disabled={isVerifying}
                className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Verifying Payment...</>
                ) : (
                  "I have paid"
                )}
              </button>
              <button
                onClick={() => setShowUpiModal(false)}
                disabled={isVerifying}
                className="w-full py-3 text-stone-500 font-medium hover:text-stone-800 transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-[10px] text-center text-stone-400">
              By clicking "I have paid", you confirm that you have completed the transaction in your UPI app.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
