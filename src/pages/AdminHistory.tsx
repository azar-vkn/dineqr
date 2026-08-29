import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, getDoc, doc, limit, where } from "firebase/firestore";
import { db } from "../firebase";
import { tenantCollection, tenantDoc } from "../lib/tenant";
import { useTenant } from "../hooks/useTenant";
import { Loader2, Clock, Search, Filter, ChevronDown, ChevronUp, Calendar, UserCheck, ClipboardList, IndianRupee, CheckCircle2, XCircle } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { cn } from "../lib/utils";
import { OrdersSkeleton } from "../components/Skeletons";
import type { Order } from "../types";

export default function AdminHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { restaurantId, loading: tenantLoading } = useTenant();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, { rating: number, comment?: string } | null>>({});
  const [sortField, setSortField] = useState<"date" | "total" | "table">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Fetch feedback when an order is expanded
  useEffect(() => {
    if (expandedOrder && feedbacks[expandedOrder] === undefined) {
      getDoc(restaurantId ? tenantDoc(db, restaurantId, "feedback", expandedOrder) : doc(db, "feedback", expandedOrder)).then(snap => {
        if (snap.exists()) {
          setFeedbacks(prev => ({ ...prev, [expandedOrder]: snap.data() as any }));
        } else {
          setFeedbacks(prev => ({ ...prev, [expandedOrder]: null }));
        }
      }).catch(err => console.error("Error fetching feedback:", err));
    }
  }, [expandedOrder, feedbacks]);

  useEffect(() => {
    // When a date is chosen, query THAT day server-side so older orders are
    // reachable; otherwise stream the most-recent 300 (unbounded reads were the
    // old bug). Range + orderBy on the same field needs no composite index.
    if (tenantLoading) return;
    const ordersRef = restaurantId ? tenantCollection(db, restaurantId, "orders") : collection(db, "orders");
    const start = dateFilter ? new Date(`${dateFilter}T00:00:00`) : null;
    const end = start ? new Date(start.getTime() + 86400000) : null;
    const q = start && end
      ? query(
          ordersRef,
          where("createdAt", ">=", start),
          where("createdAt", "<", end),
          orderBy("createdAt", "desc")
        )
      : query(ordersRef, orderBy("createdAt", "desc"), limit(300));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    return () => unsubscribe();
  }, [dateFilter, restaurantId, tenantLoading]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Order History</h1>
          <p className="text-stone-400 mt-1 text-sm">Complete record of all orders with details.</p>
        </header>
        <OrdersSkeleton count={4} />
      </div>
    );
  }

  // Apply filters
  let filteredOrders = [...orders];

  // Status filter
  if (statusFilter !== "all") {
    filteredOrders = filteredOrders.filter(o => o.status === statusFilter);
  }

  // Payment filter
  if (paymentFilter !== "all") {
    filteredOrders = filteredOrders.filter(o => o.paymentStatus === paymentFilter);
  }

  // Date filter
  if (dateFilter) {
    filteredOrders = filteredOrders.filter(o => {
      if (!o.createdAt?.toDate) return false;
      const orderDate = o.createdAt.toDate().toISOString().split("T")[0];
      return orderDate === dateFilter;
    });
  }

  // Search (by table number, item name, or order ID)
  if (searchQuery.trim()) {
    const lowerQuery = searchQuery.toLowerCase();
    filteredOrders = filteredOrders.filter(o =>
      o.tableNumber.toLowerCase().includes(lowerQuery) ||
      o.id.toLowerCase().includes(lowerQuery) ||
      o.items.some(item => item.name.toLowerCase().includes(lowerQuery))
    );
  }

  // Source filter
  if (sourceFilter !== "all") {
    if (sourceFilter === "staff") {
      filteredOrders = filteredOrders.filter(o => o.orderSource === "staff");
    } else {
      filteredOrders = filteredOrders.filter(o => !o.orderSource || o.orderSource === "customer");
    }
  }

  // Sort
  filteredOrders.sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    if (sortField === "date") {
      const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
      const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
      return (aTime - bTime) * dir;
    }
    if (sortField === "total") return (a.total - b.total) * dir;
    if (sortField === "table") return a.tableNumber.localeCompare(b.tableNumber) * dir;
    return 0;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800",
      preparing: "bg-blue-100 text-blue-800",
      ready: "bg-emerald-100 text-emerald-800",
      served: "bg-stone-100 text-stone-700",
      cancelled: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-stone-100 text-stone-700";
  };

  const getPaymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-800",
      failed: "bg-red-100 text-red-800",
      pending_collection: "bg-amber-100 text-amber-800",
    };
    return styles[status] || "bg-stone-100 text-stone-700";
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "—";
    const date = timestamp.toDate();
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "—";
    const date = timestamp.toDate();
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
      : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />;
  };

  // Summary stats
  const totalRevenue = filteredOrders
    .filter(o => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);
  const servedCount = filteredOrders.filter(o => o.status === "served").length;
  const cancelledCount = filteredOrders.filter(o => o.status === "cancelled").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="animate-fade-in-up">
        <h1 className="text-3xl font-black text-stone-900 tracking-tight">Order History</h1>
        <p className="text-stone-400 mt-1 text-sm">Complete record of all orders with details.</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up delay-75">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Total Orders</p>
          </div>
          <p className="text-3xl font-black text-stone-900">{filteredOrders.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Revenue</p>
          </div>
          <p className="text-3xl font-black text-emerald-700">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-stone-400 opacity-40" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-stone-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Served</p>
          </div>
          <p className="text-3xl font-black text-stone-900">{servedCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Cancelled</p>
          </div>
          <p className="text-3xl font-black text-red-600">{cancelledCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm animate-fade-in-up delay-150">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by table, item name, or order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="served">Served</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="pending_collection">Cash (Pending)</option>
            <option value="failed">Failed</option>
          </select>

          {/* Source Filter */}
          <div className="relative">
            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="customer">Customer Orders</option>
              <option value="staff">Staff Orders</option>
            </select>
          </div>

          {/* Clear filters */}
          {(searchQuery || dateFilter || statusFilter !== "all" || paymentFilter !== "all" || sourceFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDateFilter("");
                setStatusFilter("all");
                setPaymentFilter("all");
                setSourceFilter("all");
              }}
              className="px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors whitespace-nowrap"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden animate-fade-in-up delay-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                <th
                  className="p-4 font-semibold cursor-pointer hover:text-stone-800 select-none transition-colors"
                  onClick={() => toggleSort("date")}
                >
                  Date & Time <SortIcon field="date" />
                </th>
                <th
                  className="p-4 font-semibold cursor-pointer hover:text-stone-800 select-none transition-colors"
                  onClick={() => toggleSort("table")}
                >
                  Table <SortIcon field="table" />
                </th>
                <th className="p-4 font-semibold">Items</th>
                <th
                  className="p-4 font-semibold cursor-pointer hover:text-stone-800 select-none transition-colors"
                  onClick={() => toggleSort("total")}
                >
                  Total <SortIcon field="total" />
                </th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Payment</th>
                <th className="p-4 font-semibold">Ordered By</th>
                <th className="p-4 font-semibold">Order ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center">
                        <Clock className="w-7 h-7 text-stone-300" />
                      </div>
                      <p className="text-stone-500 font-semibold">No orders found</p>
                      <p className="text-stone-400 text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "table-row-hover cursor-pointer transition-all",
                      expandedOrder === order.id && "bg-emerald-50/40 !border-l-emerald-500"
                    )}
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-stone-800 text-sm">{formatDate(order.createdAt)}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{formatTime(order.createdAt)}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-black text-emerald-900 text-lg">{order.tableNumber}</span>
                        {order.customerName && order.customerName !== "Guest" && (
                          <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">{order.customerName}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {expandedOrder === order.id ? (
                        <div className="space-y-4 animate-fade-in">
                          <div className="space-y-1.5">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm gap-4">
                                <span className="text-stone-700">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold mr-1.5">{item.quantity}</span>
                                  {item.name}
                                </span>
                                <span className="text-stone-500 whitespace-nowrap font-medium">₹{item.price * item.quantity}</span>
                              </div>
                            ))}
                          </div>
                          
                          {feedbacks[order.id] && (
                            <div className="pt-3 border-t border-stone-100">
                              <div className="flex items-center gap-1 mb-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <span key={star} className={`text-base leading-none tracking-tighter ${star <= feedbacks[order.id]!.rating ? "text-amber-400" : "text-stone-200"}`}>★</span>
                                ))}
                                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-2">Rating</span>
                              </div>
                              {feedbacks[order.id]!.comment && (
                                <p className="text-sm text-stone-600 italic bg-stone-50 p-2.5 rounded-lg border border-stone-100 mt-1.5">"{feedbacks[order.id]!.comment}"</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-600 truncate max-w-[200px]">
                          {order.items.map(i => `${i.quantity}× ${i.name}`).join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-emerald-700">₹{order.total}</span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold capitalize",
                        getStatusBadge(order.status)
                      )}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold w-fit",
                          getPaymentBadge(order.paymentStatus)
                        )}>
                          {order.paymentStatus === "pending_collection" ? "Cash" : order.paymentStatus}
                        </span>
                        {order.paymentMethod && (
                          <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                            via {order.paymentMethod}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {order.orderSource === 'staff' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 whitespace-nowrap">
                          👤 {order.staffName || 'Staff'}
                          <span className="text-indigo-400 font-mono text-[10px]">({order.staffId || '—'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-500">
                          🙋 Customer
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-mono text-stone-400 truncate block max-w-[100px]" title={order.id}>
                        {order.id.slice(0, 8)}...
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredOrders.length > 0 && (
          <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between text-sm text-stone-500">
            <span className="font-medium">Showing <span className="text-stone-800 font-bold">{filteredOrders.length}</span> of {orders.length}{orders.length >= 300 ? "+ (most recent)" : ""} orders</span>
            <span className="text-stone-400">Click a row to expand item details</span>
          </div>
        )}
      </div>
    </div>
  );
}
