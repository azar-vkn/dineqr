import React from "react";
import { CheckCircle2, Clock, ChefHat, Utensils, BellRing, Wallet, Timer } from "lucide-react";
import type { Order, OrderStatus, UserRole } from "../types";

interface OrderCardProps {
  order: Order;
  role: UserRole | null;
  confirmingOrderId: string | null;
  onConfirmStart: (orderId: string) => void;
  onConfirmCancel: () => void;
  onMarkPaid: (orderId: string) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-800 border-amber-200 animate-blink";
    case "preparing": return "bg-blue-100 text-blue-800 border-blue-200";
    case "ready": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "served": return "bg-stone-100 text-stone-600 border-stone-200";
    case "cancelled": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-stone-100 text-stone-800";
  }
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case "pending": return <BellRing className="w-3.5 h-3.5" />;
    case "preparing": return <ChefHat className="w-3.5 h-3.5" />;
    case "ready": return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "served": return <Utensils className="w-3.5 h-3.5" />;
    case "cancelled": return <span className="w-3.5 h-3.5 flex items-center justify-center text-xs font-bold">✕</span>;
    default: return null;
  }
}

function getAccentClass(status: string): string {
  switch (status) {
    case "pending": return "accent-left-pending";
    case "preparing": return "accent-left-preparing";
    case "ready": return "accent-left-ready";
    case "served": return "accent-left-served";
    case "cancelled": return "accent-left-cancelled";
    default: return "";
  }
}

function getHeaderGradient(status: string): string {
  switch (status) {
    case "pending": return "bg-gradient-to-r from-amber-50/80 to-white";
    case "preparing": return "bg-gradient-to-r from-blue-50/60 to-white";
    case "ready": return "bg-gradient-to-r from-emerald-50/60 to-white";
    default: return "bg-stone-50/50";
  }
}

function getElapsedTime(timestamp: any): string {
  if (!timestamp?.toDate) return "";
  const now = new Date();
  const then = timestamp.toDate();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  role,
  confirmingOrderId,
  onConfirmStart,
  onConfirmCancel,
  onMarkPaid,
  onUpdateStatus,
}) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col card-hover animate-fade-in-up ${getAccentClass(order.status)} ${order.status === 'pending' ? 'border-amber-300 shadow-amber-100/50 shadow-lg ring-2 ring-amber-100' : 'border-stone-200/80'}`}>
      {/* Header */}
      <div className={`p-5 border-b flex justify-between items-start ${getHeaderGradient(order.status)} border-stone-100`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Table</span>
            <span className="text-3xl font-black text-emerald-900">{order.tableNumber}</span>
          </div>
          {order.customerName && order.customerName !== "Guest" && (
            <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mt-0.5">{order.customerName}</p>
          )}
          {order.orderType && (
            <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              order.orderType === 'parcel' 
                ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {order.orderType === 'parcel' ? '📦 Parcel' : '🍽️ Dine In'}
            </span>
          )}
          {/* Order Source Badge */}
          {order.orderSource === 'staff' ? (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200">
              👤 Staff: {order.staffName || 'Unknown'} ({order.staffId || '—'})
            </span>
          ) : order.orderSource === 'customer' ? (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-500 border border-stone-200">
              🙋 Customer Order
            </span>
          ) : null}
          <div className="flex items-center gap-2 mt-1.5">
            <Timer className="w-3 h-3 text-stone-400" />
            <p className="text-[11px] text-stone-400 font-medium">
              {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
              <span className="text-stone-300 mx-1">·</span>
              <span className={`${order.status === 'pending' ? 'text-amber-600' : 'text-stone-400'}`}>
                {getElapsedTime(order.createdAt)}
              </span>
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
          {getStatusIcon(order.status)}
          <span className="capitalize">{order.status}</span>
        </div>
      </div>
      
      {/* Items */}
      <div className="p-5 flex-1">
        <ul className="space-y-2.5">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between text-sm">
              <span className="font-medium text-stone-800">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-stone-100 text-stone-500 text-[11px] font-bold mr-2">{item.quantity}</span>
                {item.name}
              </span>
              <span className="text-stone-500 font-medium">₹{item.price * item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Footer */}
      <div className="p-5 bg-stone-50/80 border-t border-stone-100 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-stone-500">{order.paymentStatus === "paid" ? "Paid Online" : "Cash Payment"}</span>
          <span className="text-xl font-black text-emerald-700">₹{order.total}</span>
        </div>
        
        {order.paymentStatus === "pending_collection" && role === "admin" && (
          <div className="bg-red-50 text-red-800 text-sm font-bold px-3 py-4 rounded-xl text-center border border-red-100 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <Wallet className="w-5 h-5" />
              <span>Offline Payment : Amount need to be collected</span>
            </div>
            
            {confirmingOrderId === order.id ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-600">Confirm cash collection?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onMarkPaid(order.id)}
                    className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-emerald-700 transition-all font-bold shadow-sm active:scale-95"
                  >
                    Yes, Collected
                  </button>
                  <button 
                    onClick={onConfirmCancel}
                    className="flex-1 bg-stone-400 text-white py-2 px-4 rounded-lg text-sm hover:bg-stone-500 transition-all font-bold shadow-sm active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => onConfirmStart(order.id)}
                className="bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-all font-bold shadow-sm active:scale-95"
              >
                Collected
              </button>
            )}
          </div>
        )}
        
        {order.paymentStatus !== "pending_collection" && (
          <div className="grid grid-cols-4 gap-2">
            <button 
              onClick={() => onUpdateStatus(order.id, "preparing")}
              disabled={order.status === "preparing"}
              className="py-2.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-all active:scale-95 border border-blue-100"
            >
              Prepare
            </button>
            <button 
              onClick={() => onUpdateStatus(order.id, "ready")}
              disabled={order.status === "ready"}
              className="py-2.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-all active:scale-95 border border-emerald-100"
            >
              Ready
            </button>
            <button 
              onClick={() => onUpdateStatus(order.id, "served")}
              className="py-2.5 text-xs font-bold rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 transition-all disabled:opacity-40 active:scale-95 border border-stone-200"
            >
              Served
            </button>
            <button 
              onClick={() => onUpdateStatus(order.id, "cancelled")}
              className="py-2.5 text-xs font-bold rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-all active:scale-95 border border-red-100"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
