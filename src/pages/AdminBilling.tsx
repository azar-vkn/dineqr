import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Loader2,
  Download,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  FileText,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { cn } from "../lib/utils";
import type { Bill } from "../types";

export default function AdminBilling() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"date" | "total" | "table">(
    "date"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    // Date-range query server-side when a range is chosen so older bills are
    // reachable; otherwise stream the most-recent 300 (unbounded reads were the
    // old bug). Range + orderBy on the same field needs no composite index.
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const end = dateTo ? new Date(new Date(`${dateTo}T00:00:00`).getTime() + 86400000) : null;
    let q;
    if (start && end) {
      q = query(collection(db, "bills"), where("createdAt", ">=", start), where("createdAt", "<", end), orderBy("createdAt", "desc"));
    } else if (start) {
      q = query(collection(db, "bills"), where("createdAt", ">=", start), orderBy("createdAt", "desc"), limit(300));
    } else if (end) {
      q = query(collection(db, "bills"), where("createdAt", "<", end), orderBy("createdAt", "desc"), limit(300));
    } else {
      q = query(collection(db, "bills"), orderBy("createdAt", "desc"), limit(300));
    }
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Bill[] = [];
        snapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() } as Bill);
        });
        setBills(fetched);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, "bills");
      }
    );
    return () => unsubscribe();
  }, [dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">
            Billing
          </h1>
          <p className="text-stone-400 mt-1 text-sm">
            All bills, revenue, and export tools.
          </p>
        </header>
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
          <p className="text-stone-400 font-medium">Loading bills...</p>
        </div>
      </div>
    );
  }

  // ─── Filtering ────────────────────────────────────
  let filtered = [...bills];

  if (paymentFilter !== "all") {
    filtered = filtered.filter((b) => b.paymentStatus === paymentFilter);
  }

  if (dateFrom) {
    filtered = filtered.filter((b) => {
      if (!b.createdAt?.toDate) return false;
      return b.createdAt.toDate().toISOString().split("T")[0] >= dateFrom;
    });
  }
  if (dateTo) {
    filtered = filtered.filter((b) => {
      if (!b.createdAt?.toDate) return false;
      return b.createdAt.toDate().toISOString().split("T")[0] <= dateTo;
    });
  }

  if (searchQuery.trim()) {
    const lq = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.billNumber.toLowerCase().includes(lq) ||
        b.tableNumber.toLowerCase().includes(lq) ||
        b.customerName.toLowerCase().includes(lq) ||
        b.orderId.toLowerCase().includes(lq) ||
        b.items.some((i) => i.name.toLowerCase().includes(lq))
    );
  }

  // ─── Sorting ──────────────────────────────────────
  filtered.sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    if (sortField === "date") {
      const at = a.createdAt?.toDate?.()?.getTime() || 0;
      const bt = b.createdAt?.toDate?.()?.getTime() || 0;
      return (at - bt) * dir;
    }
    if (sortField === "total") return (a.total - b.total) * dir;
    if (sortField === "table")
      return a.tableNumber.localeCompare(b.tableNumber) * dir;
    return 0;
  });

  // ─── Summary Stats ────────────────────────────────
  const totalRevenue = filtered.reduce((s, b) => s + b.total, 0);
  const totalGST = filtered.reduce((s, b) => s + b.gstAmount, 0);
  const avgBill =
    filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0;

  // ─── Export CSV ────────────────────────────────────
  const handleExportCSV = () => {
    const header = [
      "Bill Number",
      "Date",
      "Time",
      "Table",
      "Customer",
      "Order Type",
      "Items",
      "Subtotal",
      "GST Rate",
      "GST Amount",
      "Total",
      "Payment Method",
      "Payment Status",
      "Order ID",
    ];

    const rows = filtered.map((b) => {
      const date = b.createdAt?.toDate?.();
      return [
        b.billNumber,
        date
          ? date.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "",
        date
          ? date.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          : "",
        b.tableNumber,
        b.customerName,
        b.orderType === "parcel" ? "Parcel" : "Dine-In",
        b.items.map((i) => `${i.quantity}x ${i.name}`).join("; "),
        b.subtotal,
        `${b.gstRate}%`,
        b.gstAmount,
        b.total,
        b.paymentMethod === "cash" ? "Cash" : "Online",
        b.paymentStatus,
        b.orderId,
      ];
    });

    const csvContent = [
      header.join(","),
      ...rows.map((r) =>
        r
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dineqr-bills-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
    );
  };

  const formatDate = (ts: any) => {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">
            Billing
          </h1>
          <p className="text-stone-400 mt-1 text-sm">
            All bills, revenue, and export tools.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-200/50 active:scale-95"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up delay-75">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Total Bills</p>
          </div>
          <p className="text-3xl font-black text-stone-900">
            {filtered.length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Total Revenue</p>
          </div>
          <p className="text-3xl font-black text-emerald-700">
            ₹{totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">Avg. Bill</p>
          </div>
          <p className="text-3xl font-black text-stone-900">
            ₹{avgBill.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 opacity-60" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-stone-400 font-medium">GST Collected</p>
          </div>
          <p className="text-3xl font-black text-purple-700">
            ₹{totalGST.toLocaleString()}
          </p>
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
              placeholder="Search by bill#, table, customer, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-10 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                placeholder="From"
              />
            </div>
            <span className="text-stone-400 text-sm font-medium">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Payments</option>
            <option value="paid">Online Paid</option>
            <option value="pending_collection">Cash</option>
          </select>

          {/* Clear */}
          {(searchQuery ||
            dateFrom ||
            dateTo ||
            paymentFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDateFrom("");
                setDateTo("");
                setPaymentFilter("all");
              }}
              className="px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors whitespace-nowrap"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden animate-fade-in-up delay-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Bill #</th>
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
                <th className="p-4 font-semibold">Subtotal</th>
                <th className="p-4 font-semibold">GST</th>
                <th
                  className="p-4 font-semibold cursor-pointer hover:text-stone-800 select-none transition-colors"
                  onClick={() => toggleSort("total")}
                >
                  Total <SortIcon field="total" />
                </th>
                <th className="p-4 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center">
                        <FileText className="w-7 h-7 text-stone-300" />
                      </div>
                      <p className="text-stone-500 font-semibold">
                        No bills found
                      </p>
                      <p className="text-stone-400 text-sm">
                        Try adjusting your filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((bill) => (
                  <tr
                    key={bill.id}
                    className={cn(
                      "table-row-hover cursor-pointer transition-all",
                      expandedBill === bill.id && "bg-emerald-50/40 !border-l-emerald-500"
                    )}
                    onClick={() =>
                      setExpandedBill(
                        expandedBill === bill.id ? null : bill.id
                      )
                    }
                  >
                    <td className="p-4">
                      <span className="font-mono font-bold text-emerald-800 text-sm">
                        {bill.billNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-stone-800 text-sm">
                          {formatDate(bill.createdAt)}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {formatTime(bill.createdAt)}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-black text-emerald-900 text-lg">
                          {bill.tableNumber}
                        </span>
                        {bill.customerName &&
                          bill.customerName !== "Guest" && (
                            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                              {bill.customerName}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="p-4">
                      {expandedBill === bill.id ? (
                        <div className="space-y-1.5 animate-fade-in">
                          {bill.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-sm gap-4"
                            >
                              <span className="text-stone-700">
                                <span className="text-stone-400 mr-1.5">
                                  {item.quantity}×
                                </span>
                                {item.name}
                              </span>
                              <span className="text-stone-500 whitespace-nowrap">
                                ₹{item.subtotal}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-600 truncate max-w-[200px]">
                          {bill.items
                            .map((i) => `${i.quantity}× ${i.name}`)
                            .join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-stone-600 text-sm">
                        ₹{bill.subtotal}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-stone-500 text-sm">
                        ₹{bill.gstAmount}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-emerald-700">
                        ₹{bill.total}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-bold w-fit",
                            bill.paymentStatus === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {bill.paymentStatus === "paid" ? "Paid" : "Cash"}
                        </span>
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                          via{" "}
                          {bill.paymentMethod === "cash" ? "cash" : "online"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between text-sm text-stone-500">
            <span className="font-medium">Showing <span className="text-stone-800 font-bold">{filtered.length}</span> of {bills.length} bills</span>
            <span className="text-stone-400">Click a row to expand item details</span>
          </div>
        )}
      </div>
    </div>
  );
}
