import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Loader2, CheckCircle2, Clock, ChefHat, Utensils, ArrowLeft } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  paymentStatus: string;
  createdAt: any;
}

const STATUS_STEPS = [
  { id: "pending", label: "Order Placed", icon: Clock, color: "text-amber-500", bgColor: "bg-amber-500", lightBg: "bg-amber-100" },
  { id: "preparing", label: "Preparing", icon: ChefHat, color: "text-orange-500", bgColor: "bg-orange-500", lightBg: "bg-orange-100" },
  { id: "ready", label: "Ready", icon: CheckCircle2, color: "text-emerald-500", bgColor: "bg-emerald-500", lightBg: "bg-emerald-100" },
  { id: "served", label: "Served", icon: Utensils, color: "text-stone-500", bgColor: "bg-stone-500", lightBg: "bg-stone-100" },
];

export default function TrackOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(
      doc(db, "orders", orderId),
      (docSnap) => {
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, `orders/${orderId}`);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-stone-500 font-medium">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
          <span className="text-3xl">❓</span>
        </div>
        <h2 className="text-2xl font-bold text-stone-800">Order Not Found</h2>
        <p className="text-stone-500 max-w-xs">We couldn't find the order you're looking for.</p>
        <button 
          onClick={() => navigate("/")}
          className="mt-4 px-6 py-2 bg-stone-800 text-white font-medium rounded-full hover:bg-stone-900 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.id === order.status);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(`/table/${order.tableNumber}`)}
          className="p-2 bg-white rounded-full shadow-sm border border-stone-200 text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-stone-800">Track Order</h1>
      </div>

      {/* Status Tracker */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-bold text-stone-800">Order Status</h2>
          <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-sm font-medium">
            Table {order.tableNumber}
          </span>
        </div>

        {order.status !== "cancelled" && (
          <div className="relative">
            {/* Progress Bar Background */}
            <div className="absolute top-6 left-6 right-6 h-1 bg-stone-100 rounded-full -z-10"></div>
            
            {/* Active Progress Bar */}
            <div 
              className="absolute top-6 left-6 h-1 bg-emerald-500 rounded-full -z-10 transition-all duration-500 ease-in-out"
              style={{ width: `calc(${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}% - 24px)` }}
            ></div>

            <div className="flex justify-between relative z-10">
              {STATUS_STEPS.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index <= currentStepIndex;
                const Icon = step.icon;

                return (
                  <div key={step.id} className="flex flex-col items-center gap-3 w-1/4">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white shadow-sm
                        ${isActive ? `${step.bgColor} text-white scale-110 shadow-md` : 
                          isCompleted ? 'bg-emerald-500 text-white' : 
                          'bg-stone-100 text-stone-400'}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs sm:text-sm font-medium text-center transition-colors duration-300
                      ${isActive ? step.color : isCompleted ? 'text-stone-800' : 'text-stone-400'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="mt-8 p-4 rounded-xl bg-stone-50 border border-stone-100 text-center relative overflow-hidden">
          {order.status === "pending" && (
            <>
              <p className="text-stone-600 font-medium">Your order has been received and is waiting for the kitchen to accept.</p>
              <p className="text-sm text-stone-500 mt-2 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" /> Estimated time: 15-20 mins
              </p>
            </>
          )}
          {order.status === "preparing" && (
            <>
              <p className="text-orange-600 font-medium">The chefs are preparing your delicious food! 🍳</p>
              <p className="text-sm text-orange-500 mt-2 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" /> Estimated time: 10-15 mins
              </p>
            </>
          )}
          {order.status === "ready" && (
            <p className="text-emerald-600 font-bold text-lg animate-pulse">Your order is ready! Please wait for service. 🍽️</p>
          )}
          {order.status === "served" && (
            <p className="text-stone-600 font-medium">Your order has been served. Enjoy your meal! 🎉</p>
          )}
          {order.status === "cancelled" && (
            <p className="text-red-600 font-medium">Your order has been cancelled. Please contact the staff for assistance. ❌</p>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4">
        {order.paymentStatus === "pending_collection" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-center mb-4">
            <p className="font-bold">Please go to the cashier for offline payment.</p>
            <p className="text-sm mt-1">Your order is being processed, but payment needs to be collected.</p>
          </div>
        )}
        <h3 className="font-bold text-stone-800 text-lg border-b border-stone-100 pb-4">Order Summary</h3>
        
        <ul className="space-y-3 pt-2">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between text-stone-700">
              <span className="font-medium">
                <span className="text-stone-400 mr-2">{item.quantity}x</span>
                {item.name}
              </span>
              <span>₹{item.price * item.quantity}</span>
            </li>
          ))}
        </ul>

        <div className="pt-4 border-t border-stone-100 flex justify-between items-center font-bold text-lg text-stone-900">
          <span>Total ({order.paymentStatus === "paid" ? "Paid" : "Cash"})</span>
          <span className="text-emerald-700">₹{order.total}</span>
        </div>
      </div>
    </div>
  );
}
