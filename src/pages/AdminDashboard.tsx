import { useState, useRef, useEffect } from "react";
import { updateDoc, doc, getDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { Filter, Utensils, Plus, UserCheck, Clock, ChefHat, CheckCircle2, Package } from "lucide-react";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { useOrders } from "../hooks/useOrders";
import { useUserRole } from "../hooks/useUserRole";
import OrderCard from "../components/OrderCard";
import StaffOrderModal from "../components/StaffOrderModal";
import { OrdersSkeleton } from "../components/Skeletons";
import { BOOTSTRAP_ADMIN_EMAIL } from "../lib/constants";
import type { OrderStatus, Order } from "../types";

export default function AdminDashboard() {
  const { orders, loading } = useOrders({ maxOrders: 100 });
  const { role } = useUserRole();
  const [selectedTable, setSelectedTable] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [showStaffOrder, setShowStaffOrder] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ staffId: string; staffName: string }>({ staffId: "", staffName: "" });
  const previousOrderCount = useRef<number>(0);
  const { user } = useUserRole();

  // Fetch current user's staff profile
  useEffect(() => {
    if (!user?.email) return;
    if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
      setStaffInfo({ staffId: "ADMIN", staffName: "Admin" });
      return;
    }
    getDoc(doc(db, "users", user.email)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStaffInfo({
          staffId: data.staffId || "STAFF",
          staffName: data.displayName || user.email || "Staff",
        });
      } else {
        setStaffInfo({ staffId: "STAFF", staffName: user.email || "Staff" });
      }
    }).catch(() => {
      setStaffInfo({ staffId: "STAFF", staffName: user.email || "Staff" });
    });
  }, [user]);

  // ─── New Order Notification ────────────────────────────────
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  // Check for new pending orders for notification
  const visibleOrders = orders.filter(o => {
    if (role === 'staff' && o.paymentStatus === 'pending_collection') return false;
    return true;
  });
  const currentPendingCount = visibleOrders.filter(o => o.status === "pending").length;

  // Fire the new-order alert as a SIDE EFFECT — never during render. Doing this
  // in the render body meant React 19's concurrent/StrictMode re-renders could
  // double-beep or toast spuriously and mutate the ref mid-render.
  useEffect(() => {
    if (loading) return;
    if (currentPendingCount > previousOrderCount.current) {
      playNotificationSound();
      toast("🔔 New Order Received!", {
        description: "A new order has been placed.",
        duration: 5000,
      });
    }
    previousOrderCount.current = currentPendingCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPendingCount, loading]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      if (newStatus === "cancelled") toast.success("Order cancelled");
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update status: " + (error.message || "Unknown error"));
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const markAsPaid = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { paymentStatus: "paid" });
      toast.success("Payment marked as collected. Order is now visible to staff.");
      setConfirmingOrderId(null);
    } catch (error: any) {
      console.error("Error marking as paid:", error);
      toast.error("Failed to mark as collected: " + (error.message || "Unknown error"));
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };



  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Live Orders</h1>
            <p className="text-stone-500 mt-1">Manage incoming orders from tables in real-time.</p>
          </div>
        </header>
        <OrdersSkeleton count={6} />
      </div>
    );
  }

  // Filter orders based on role and status
  const activeOrders = orders.filter(o => {
    if (o.status === "served" || o.status === "cancelled") return false;
    if (role === 'staff' && o.paymentStatus === 'pending_collection') return false;
    return true;
  });
  
  const tableNumbers = Array.from(new Set(activeOrders.map(o => String(o.tableNumber)))).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Apply source filter
  const sourceFiltered = sourceFilter === "All" 
    ? activeOrders 
    : sourceFilter === "Staff"
      ? activeOrders.filter(o => o.orderSource === "staff")
      : activeOrders.filter(o => !o.orderSource || o.orderSource === "customer");

  const filteredOrders = selectedTable === "All" 
    ? sourceFiltered 
    : sourceFiltered.filter(o => o.tableNumber === selectedTable);

  // Status counts
  const pendingCount = activeOrders.filter(o => o.status === "pending").length;
  const preparingCount = activeOrders.filter(o => o.status === "preparing").length;
  const readyCount = activeOrders.filter(o => o.status === "ready").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Live Orders</h1>
          <p className="text-stone-400 mt-1 text-sm">Manage incoming orders from tables in real-time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Place Order Button */}
          <button
            onClick={() => setShowStaffOrder(true)}
            className="flex items-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 rounded-xl shadow-md shadow-indigo-200/50 hover:shadow-lg hover:from-indigo-700 hover:to-indigo-800 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Place Order
          </button>


        </div>
      </header>

      {/* Quick Summary Bar — Inspired by attendance dashboard */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 animate-fade-in-up delay-75">
        <div className="flex flex-wrap items-center gap-3">
          {/* Active badge */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl font-bold text-sm">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>{activeOrders.length} Active</span>
          </div>

          <div className="h-8 w-px bg-stone-200 hidden sm:block" />

          {/* Status summary dots */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-black text-stone-900 leading-tight">{pendingCount}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Pending</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-black text-stone-900 leading-tight">{preparingCount}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Preparing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-black text-stone-900 leading-tight">{readyCount}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Ready</p>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-stone-200 hidden sm:block" />

          {/* Filters */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              <select 
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="bg-transparent text-sm font-medium text-stone-700 focus:outline-none cursor-pointer"
              >
                <option value="All">All Tables</option>
                {tableNumbers.map(table => (
                  <option key={table} value={table}>Table {table}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200">
              <UserCheck className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-transparent text-sm font-medium text-stone-700 focus:outline-none cursor-pointer"
              >
                <option value="All">All Sources</option>
                <option value="Customer">Customer Orders</option>
                <option value="Staff">Staff Orders</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Order Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredOrders.map((order, index) => (
          <div key={order.id} style={{ animationDelay: `${index * 50}ms` }}>
            <OrderCard
              order={order}
              role={role}
              confirmingOrderId={confirmingOrderId}
              onConfirmStart={setConfirmingOrderId}
              onConfirmCancel={() => setConfirmingOrderId(null)}
              onMarkPaid={markAsPaid}
              onUpdateStatus={updateOrderStatus}
            />
          </div>
        ))}
        
        {filteredOrders.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200 animate-fade-in">
            <div className="w-20 h-20 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Utensils className="w-9 h-9 text-stone-300" />
            </div>
            <h3 className="text-xl font-bold text-stone-700">No active orders</h3>
            <p className="text-stone-400 mt-2 text-sm max-w-sm mx-auto">
              {selectedTable === "All" ? "Waiting for customers to place orders. New orders will appear here in real-time." : `No active orders for Table ${selectedTable}.`}
            </p>
            <button
              onClick={() => setShowStaffOrder(true)}
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Place an Order
            </button>
          </div>
        )}
      </div>
      {/* Staff Order Modal */}
      <StaffOrderModal
        isOpen={showStaffOrder}
        onClose={() => setShowStaffOrder(false)}
        staffId={staffInfo.staffId}
        staffName={staffInfo.staffName}
      />
    </div>
  );
}
