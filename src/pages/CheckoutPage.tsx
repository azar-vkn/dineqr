import { useState, useEffect } from "react";
import { useCartStore } from "../store";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle2, QrCode, Smartphone, ShieldCheck } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";

export default function CheckoutPage() {
  const { items, getTotal, tableNumber, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cash">("upi");
  const [isProcessingCash, setIsProcessingCash] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const total = getTotal();
  const finalAmount = Math.round(total * 1.05); // Including 5% tax

  useEffect(() => {
    if (items.length === 0 && !orderPlaced) {
      navigate("/");
      return;
    }
    setLoading(false);
  }, [items, navigate, orderPlaced]);

  const handleCashOrder = async () => {
    setIsProcessingCash(true);
    try {
      const createCashOrder = httpsCallable(functions, "createCashOrder");
      const result = await createCashOrder({ items, tableNumber });
      const data = result.data as any;

      setOrderId(data.orderId);
      setOrderPlaced(true);
      clearCart();
      toast.success("Order placed! Please pay at the counter.");
      navigate(`/order/${data.orderId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orders");
    } finally {
      setIsProcessingCash(false);
    }
  };

  const initRazorpayPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const createOrder = httpsCallable(functions, "createOrder");
      const { data } = await createOrder({ items, tableNumber });
      const orderData = data as any;

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "DineQR",
        description: `Order for Table ${tableNumber}`,
        order_id: orderData.razorpayOrderId,
        handler: async function (response: any) {
          try {
            toast.loading("Verifying payment...");
            const verifyPayment = httpsCallable(functions, "verifyPayment");
            
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              firestore_order_id: orderData.orderId,
            });

            toast.dismiss();
            toast.success("Payment successful!");
            setOrderId(orderData.orderId);
            setOrderPlaced(true);
            clearCart();
            navigate(`/order/${orderData.orderId}`);
          } catch (e) {
            toast.dismiss();
            toast.error("Payment verification failed. Please contact staff.");
          }
        },
        prefill: {
          name: "Guest",
          email: "guest@example.com",
          contact: "9999999999",
        },
        theme: {
          color: "#059669",
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on('payment.failed', function (response: any){
        toast.error(`Payment failed: ${response.error.description}`);
      });
      razorpayInstance.open();

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orders");
    } finally {
      setIsProcessingPayment(false);
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
          Pay Securely (Online)
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
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg">Secure Online Payment</h3>
                <p className="text-sm text-stone-500">Pay securely using UPI, Credit/Debit card, Netbanking, or Wallets powered by Razorpay.</p>
              </div>

              <button
                onClick={initRazorpayPayment}
                disabled={isProcessingPayment}
                className="w-full py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Initializing...</>
                ) : (
                  <><CreditCard className="w-5 h-5" /> Pay ₹{finalAmount} Securely</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
