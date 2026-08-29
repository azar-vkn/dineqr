import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { tenantCollection, tenantDoc } from "../lib/tenant";
import { useTenant } from "../hooks/useTenant";
import { toast } from "sonner";
import { Loader2, Play, CheckCircle2, AlertCircle, ChefHat, Clock } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import type { Order, OrderStatus } from "../types";

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { restaurantId, loading: tenantLoading } = useTenant();
  const prevPendingIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 880; // A5 note
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio alert failed", e);
    }
  };

  useEffect(() => {
    if (tenantLoading) return;
    // Only fetch orders that need kitchen attention
    const q = query(
      restaurantId ? tenantCollection(db, restaurantId, "orders") : collection(db, "orders"),
      where("status", "in", ["pending", "preparing", "ready"]),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Order[];
        
        const newPendingIds = new Set(
          fetchedOrders.filter(o => o.status === "pending").map(o => o.id)
        );

        if (!isInitialLoad.current) {
          let hasNewPending = false;
          newPendingIds.forEach(id => {
            if (!prevPendingIds.current.has(id)) {
              hasNewPending = true;
            }
          });

          if (hasNewPending) {
            playAlertSound();
            toast('🔔 New Order Arrived!', { style: { background: '#10b981', color: '#fff', border: 'none' } });
          }
        } else {
          isInitialLoad.current = false;
        }

        prevPendingIds.current = newPendingIds;
        
        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "orders");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId, tenantLoading]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(
        restaurantId ? tenantDoc(db, restaurantId, "orders", orderId) : doc(db, "orders", orderId),
        { status: newStatus }
      );
      toast.success(`Order marked as ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    }
  };

  const getWaitTime = (createdAt: any) => {
    if (!createdAt) return "0m";
    const then = createdAt.toDate();
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const renderOrderCard = (order: Order, isPending: boolean) => (
    <div key={order.id} className="bg-stone-800 rounded-xl overflow-hidden border border-stone-700 flex flex-col shadow-lg">
      {/* Card Header */}
      <div className={`p-3 flex items-center justify-between ${isPending ? 'bg-orange-800/20 border-b border-orange-800/40 text-orange-400' : 'bg-blue-800/20 border-b border-blue-800/40 text-blue-400'}`}>
        <h3 className="font-bold text-xl text-stone-100 flex-1">Table {order.tableNumber}</h3>
        <div className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
          <Clock className="w-4 h-4" />
          {getWaitTime(order.createdAt)}
        </div>
      </div>

      {/* Main Order Items */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <ul className="space-y-1.5 flex-1">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex items-start text-stone-200">
              <span className="font-bold text-emerald-400 mr-2 min-w-[1.5rem]">{item.quantity}×</span>
              <span className="font-medium text-lg leading-tight">{item.name}</span>
            </li>
          ))}
        </ul>
        
        {/* Badges/Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="inline-flex py-1 px-2 rounded bg-stone-900 border border-stone-700 text-stone-400 text-xs font-bold uppercase">
            {order.orderType === 'parcel' ? '📦 Parcel' : '🍽️ Dine In'}
          </span>
          <span className="inline-flex py-1 px-2 rounded bg-stone-900 border border-stone-700 text-stone-400 text-xs font-bold uppercase">
            {order.orderSource === 'staff' ? `👤 Staff: ${order.staffName || 'Unknown'}` : '🙋 Customer'}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-2 border-t border-stone-700 bg-stone-800/50">
        {order.status === "pending" && (
          <button
            onClick={() => updateOrderStatus(order.id, "preparing")}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 text-lg shadow-sm"
          >
            <Play className="w-5 h-5 fill-current" />
            Start Preparing
          </button>
        )}
        {order.status === "preparing" && (
          <button
            onClick={() => updateOrderStatus(order.id, "ready")}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 text-lg shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5" />
            Mark Ready
          </button>
        )}
        {order.status === "ready" && (
          <div className="w-full py-3 bg-stone-700/50 text-emerald-400 font-bold rounded-lg flex items-center justify-center gap-2 text-lg border border-stone-600/50 cursor-default">
            <CheckCircle2 className="w-5 h-5" />
            Waiting for Service
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        {/* Pending Column */}
        <div className="bg-stone-950/50 rounded-2xl border border-stone-800 flex flex-col overflow-hidden max-h-full">
          <div className="p-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-sm">
            <div className="flex items-center gap-2 text-orange-400">
              <AlertCircle className="w-5 h-5" />
              <h2 className="font-bold text-lg leading-none uppercase tracking-wider">Pending</h2>
            </div>
            <span className="bg-stone-800 text-stone-300 font-bold px-2.5 py-0.5 rounded-full text-sm">
              {pendingOrders.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
             {pendingOrders.map(o => renderOrderCard(o, true))}
             {pendingOrders.length === 0 && (
               <div className="text-stone-600 text-center mt-10 font-medium">No pending orders</div>
             )}
          </div>
        </div>

        {/* Preparing Column */}
        <div className="bg-stone-950/50 rounded-2xl border border-stone-800 flex flex-col overflow-hidden max-h-full">
          <div className="p-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-sm">
            <div className="flex items-center gap-2 text-blue-400">
              <ChefHat className="w-5 h-5" />
              <h2 className="font-bold text-lg leading-none uppercase tracking-wider">Preparing</h2>
            </div>
            <span className="bg-stone-800 text-stone-300 font-bold px-2.5 py-0.5 rounded-full text-sm">
              {preparingOrders.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
            {preparingOrders.map(o => renderOrderCard(o, false))}
            {preparingOrders.length === 0 && (
               <div className="text-stone-600 text-center mt-10 font-medium">No preparing orders</div>
             )}
          </div>
        </div>

        {/* Ready Column */}
        <div className="bg-stone-950/50 rounded-2xl border border-stone-800 flex flex-col overflow-hidden max-h-full opacity-60 hover:opacity-100 transition-opacity">
          <div className="p-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="font-bold text-lg leading-none uppercase tracking-wider">Ready / Waiting</h2>
            </div>
            <span className="bg-stone-800 text-stone-300 font-bold px-2.5 py-0.5 rounded-full text-sm">
              {readyOrders.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
            {readyOrders.map(o => renderOrderCard(o, false))}
            {readyOrders.length === 0 && (
               <div className="text-stone-600 text-center mt-10 font-medium">No ready orders</div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
