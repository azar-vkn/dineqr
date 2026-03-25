import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Loader2, Clock, Search, Filter, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { cn } from "../lib/utils";

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
  paymentMethod?: string;
  createdAt: any;
}

export default function AdminHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"date" | "total" | "table">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
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
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-stone-500 font-medium">Loading order history...</p>
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
      <header>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Order History</h1>
        <p className="text-stone-500 mt-1">Complete record of all orders with details.</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500">Total Orders</p>
          <p className="text-2xl font-black text-stone-900 mt-1">{filteredOrders.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500">Revenue</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500">Served</p>
          <p className="text-2xl font-black text-stone-900 mt-1">{servedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500">Cancelled</p>
          <p className="text-2xl font-black text-red-600 mt-1">{cancelledCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by table, item name, or order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm appearance-none cursor-pointer"
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
            className="px-4 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="pending_collection">Cash (Pending)</option>
            <option value="failed">Failed</option>
          </select>

          {/* Clear filters */}
          {(searchQuery || dateFilter || statusFilter !== "all" || paymentFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDateFilter("");
                setStatusFilter("all");
                setPaymentFilter("all");
              }}
              className="px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                <th
                  className="p-4 font-medium cursor-pointer hover:text-stone-800 select-none"
                  onClick={() => toggleSort("date")}
                >
                  Date & Time <SortIcon field="date" />
                </th>
                <th
                  className="p-4 font-medium cursor-pointer hover:text-stone-800 select-none"
                  onClick={() => toggleSort("table")}
                >
                  Table <SortIcon field="table" />
                </th>
                <th className="p-4 font-medium">Items</th>
                <th
                  className="p-4 font-medium cursor-pointer hover:text-stone-800 select-none"
                  onClick={() => toggleSort("total")}
                >
                  Total <SortIcon field="total" />
                </th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Order ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center">
                        <Clock className="w-7 h-7 text-stone-400" />
                      </div>
                      <p className="text-stone-500 font-medium">No orders found</p>
                      <p className="text-stone-400 text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "hover:bg-stone-50/50 transition-colors cursor-pointer",
                      expandedOrder === order.id && "bg-emerald-50/30"
                    )}
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-stone-800 text-sm">{formatDate(order.createdAt)}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{formatTime(order.createdAt)}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-black text-emerald-900 text-lg">{order.tableNumber}</span>
                    </td>
                    <td className="p-4">
                      {expandedOrder === order.id ? (
                        <div className="space-y-1.5 animate-in fade-in duration-200">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm gap-4">
                              <span className="text-stone-700">
                                <span className="text-stone-400 mr-1.5">{item.quantity}×</span>
                                {item.name}
                              </span>
                              <span className="text-stone-500 whitespace-nowrap">₹{item.price * item.quantity}</span>
                            </div>
                          ))}
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
            <span>Showing {filteredOrders.length} of {orders.length} orders</span>
            <span>Click a row to expand item details</span>
          </div>
        )}
      </div>
    </div>
  );
}
