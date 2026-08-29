import { useState, useMemo } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { tenantDoc } from "../lib/tenant";
import { useTenant } from "../hooks/useTenant";
import { toast } from "sonner";
import { useOrders } from "../hooks/useOrders";
import {
  X, Clock, Users, IndianRupee, ShoppingBag,
  List, Grid3X3, ChefHat, CheckCircle2, Loader2, Printer, Eye
} from "lucide-react";
import type { Order, OrderStatus } from "../types";

type TableStatus = "blank" | "running" | "printed" | "kot" | "paid";

interface TableData {
  id: number;
  no: string;
  tableNumber: string;
  status: TableStatus;
  guests?: number;
  amount?: number;
  startTime?: string;
  items?: { name: string; qty: number; price: number }[];
  waiter?: string;
  orderType?: string;
  orderId?: string;
  orderStatus?: OrderStatus;
}

// Define table sections (static layout — the restaurant's physical tables)
const TABLE_SECTIONS = [
  {
    name: "A/C",
    tables: Array.from({ length: 28 }, (_, i) => ({
      id: i + 1,
      no: `Table ${i + 1}`,
      tableNumber: `T${i + 1}`,
    })),
  },
  {
    name: "Non A/C",
    tables: Array.from({ length: 9 }, (_, i) => ({
      id: 29 + i,
      no: `Table ${i + 1}`,
      tableNumber: `T${29 + i}`,
    })),
  },
];

// Map order status to table status
function deriveTableStatus(order: Order): TableStatus {
  switch (order.status) {
    case "pending":
    case "preparing":
      return "running";
    case "ready":
      return "kot";
    case "served":
      return order.paymentStatus === "paid" ? "paid" : "printed";
    default:
      return "blank";
  }
}

export default function AdminPos() {
  const { orders, loading } = useOrders({ maxOrders: 200 });
  const { restaurantId } = useTenant();
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);

  // ─── Build live table map from real orders ──────────────────
  const sections = useMemo(() => {
    const activeOrders = orders.filter(o =>
      o.status !== "cancelled" && o.paymentStatus !== "paid"
    );

    const tableOrderMap = new Map<string, Order>();
    activeOrders.forEach(order => {
      const existing = tableOrderMap.get(order.tableNumber);
      if (!existing) {
        tableOrderMap.set(order.tableNumber, order);
      } else {
        const existingTime = existing.createdAt?.toDate?.()?.getTime() || 0;
        const newTime = order.createdAt?.toDate?.()?.getTime() || 0;
        if (newTime > existingTime) {
          tableOrderMap.set(order.tableNumber, order);
        }
      }
    });

    return TABLE_SECTIONS.map(section => ({
      ...section,
      tables: section.tables.map((table): TableData => {
        const order = tableOrderMap.get(table.tableNumber);
        if (!order) {
          return { ...table, status: "blank" as TableStatus };
        }

        const tableStatus = deriveTableStatus(order);
        const startTime = order.createdAt?.toDate?.()
          ? order.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
          : undefined;

        return {
          ...table,
          status: tableStatus,
          guests: order.items?.reduce((s, i) => s + i.quantity, 0) || 0,
          amount: order.total || 0,
          startTime,
          items: order.items?.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          waiter: order.staffName || order.customerName || "Customer",
          orderType: order.orderType === "parcel" ? "Take Away" : "Dine-In",
          orderId: order.id,
          orderStatus: order.status,
        };
      }),
    }));
  }, [orders]);

  // ─── Action handlers (all write to Firestore) ──────────────
  const handleSendKOT = async (table: TableData) => {
    if (!table.orderId) return;
    try {
      await updateDoc(restaurantId ? tenantDoc(db, restaurantId, "orders", table.orderId) : doc(db, "orders", table.orderId), {
        status: "preparing" as OrderStatus,
      });
      toast.success(`🔥 KOT sent for ${table.no}!`);
      setSelectedTable(null);
    } catch (error) {
      toast.error("Failed to send KOT.");
      console.error(error);
    }
  };

  const handlePrintBill = async (table: TableData) => {
    if (!table.orderId) return;
    // Don't silently skip the kitchen: printing a bill used to force ANY order
    // (even a brand-new "pending" one) straight to "served", bypassing prep.
    if (table.orderStatus && table.orderStatus !== "ready" && table.orderStatus !== "served") {
      toast.error("Food isn't ready yet — send KOT and serve before billing.");
      return;
    }
    try {
      await updateDoc(restaurantId ? tenantDoc(db, restaurantId, "orders", table.orderId) : doc(db, "orders", table.orderId), {
        status: "served" as OrderStatus,
      });
      toast.success(`🧾 Bill sent for ${table.no}!`);
      setSelectedTable(null);
    } catch (error) {
      toast.error("Failed to print bill.");
      console.error(error);
    }
  };

  const handlePaymentReceived = async (table: TableData) => {
    if (!table.orderId) return;
    try {
      await updateDoc(restaurantId ? tenantDoc(db, restaurantId, "orders", table.orderId) : doc(db, "orders", table.orderId), {
        status: "served" as OrderStatus,
        paymentStatus: "paid",
        paymentMethod: "cash",
      });
      toast.success(`✅ Payment received for ${table.no}!`);
      setSelectedTable(null);
    } catch (error) {
      toast.error("Failed to mark payment.");
      console.error(error);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────
  const getTableColor = (status: TableStatus) => {
    switch (status) {
      case "running": return "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100";
      case "printed": return "bg-green-50 border-green-300 text-green-900 shadow-green-100";
      case "kot": return "bg-yellow-50 border-yellow-300 text-yellow-900 shadow-yellow-100";
      case "paid": return "bg-stone-100 border-stone-300 text-stone-600";
      default: return "bg-white border-dashed border-stone-300 text-stone-500";
    }
  };

  const getStatusLabel = (status: TableStatus) => {
    switch (status) {
      case "running": return "Dining";
      case "printed": return "Bill Sent";
      case "kot": return "KOT";
      case "paid": return "Paid";
      default: return "Available";
    }
  };

  const getStatusDot = (status: TableStatus) => {
    switch (status) {
      case "running": return "bg-blue-500";
      case "printed": return "bg-green-500";
      case "kot": return "bg-yellow-500";
      case "paid": return "bg-stone-400";
      default: return "bg-stone-300";
    }
  };

  // Count summary
  const allTables = sections.flatMap(s => s.tables);
  const runningCount = allTables.filter(t => t.status === "running").length;
  const kotCount = allTables.filter(t => t.status === "kot").length;
  const printedCount = allTables.filter(t => t.status === "printed").length;
  const blankCount = allTables.filter(t => t.status === "blank").length;

  if (loading) {
    return (
      <div className="space-y-4 flex flex-col h-[calc(100vh-6rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-stone-400 font-medium">Loading tables...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-6rem)]">
      {/* Main Table View Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-stone-800">Table View</h2>
            {/* Quick counts */}
            <div className="hidden md:flex items-center gap-3 text-xs font-bold">
              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">{runningCount} Dining</span>
              <span className="bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-lg">{kotCount} KOT</span>
              <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-lg">{printedCount} Bill Sent</span>
              <span className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg">{blankCount} Free</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="hidden lg:flex items-center gap-4 text-xs font-semibold text-stone-500">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-stone-300" /> Available</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400" /> Dining</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400" /> KOT</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400" /> Bill Sent</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-400" /> Paid</div>
            </div>

            {/* Grid/List toggle */}
            <div className="flex bg-stone-100 rounded-lg p-0.5">
              <button
                onClick={() => setLayout("grid")}
                className={`p-1.5 rounded-md transition-all ${layout === "grid" ? "bg-white shadow-sm text-stone-800" : "text-stone-400"}`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout("list")}
                className={`p-1.5 rounded-md transition-all ${layout === "list" ? "bg-white shadow-sm text-stone-800" : "text-stone-400"}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tables Grid / List */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
          <div className="space-y-8">
            {sections.map(section => (
              <div key={section.name} className="space-y-4">
                <h3 className="font-bold text-stone-800 flex items-center gap-2">
                  {section.name}
                  <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                    {section.tables.length} tables
                  </span>
                </h3>
                
                {layout === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
                    {section.tables.map(table => (
                      <div 
                        key={table.id}
                        onClick={() => table.status !== "blank" ? setSelectedTable(table) : null}
                        className={`
                          aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-2
                          ${table.status !== "blank" ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5" : ""}
                          transition-all duration-200 relative group
                          ${getTableColor(table.status)}
                        `}
                      >
                        <span className="font-bold text-sm">{table.no}</span>
                        
                        {/* Occupancy info for active tables */}
                        {table.status !== "blank" && table.status !== "paid" && (
                          <>
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3 opacity-60" />
                              <span className="text-[10px] font-bold">{table.guests}</span>
                            </div>
                            <span className="text-[10px] font-bold opacity-70">₹{table.amount?.toLocaleString()}</span>
                            <span className="text-[9px] opacity-50 font-medium">{table.startTime}</span>
                          </>
                        )}
                        
                        {/* Status dot */}
                        {table.status !== "blank" && (
                          <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${getStatusDot(table.status)} ${table.status === "running" ? "animate-pulse" : ""}`} />
                        )}
                        
                        {/* Quick action buttons on hover */}
                        {table.status !== "blank" && (
                          <div className="absolute -bottom-3 flex items-center justify-center w-full gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrintBill(table); }}
                              className="w-6 h-6 bg-white border border-stone-200 rounded-full flex items-center justify-center shadow-sm text-stone-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                              title="Print Bill"
                            >
                              <Printer className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedTable(table); }}
                              className="w-6 h-6 bg-white border border-stone-200 rounded-full flex items-center justify-center shadow-sm text-stone-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* List View */
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50 text-stone-500">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Table</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Items</th>
                          <th className="text-left px-4 py-3 font-medium">Amount</th>
                          <th className="text-left px-4 py-3 font-medium">Since</th>
                          <th className="text-left px-4 py-3 font-medium">Ordered By</th>
                          <th className="text-right px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {section.tables.map(table => (
                          <tr
                            key={table.id}
                            onClick={() => table.status !== "blank" ? setSelectedTable(table) : null}
                            className={`${table.status !== "blank" ? "cursor-pointer" : ""} hover:bg-stone-50/50 transition-colors`}
                          >
                            <td className="px-4 py-3 font-bold text-stone-800">{table.no}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg ${
                                table.status === "running" ? "bg-blue-50 text-blue-700" :
                                table.status === "kot" ? "bg-yellow-50 text-yellow-700" :
                                table.status === "printed" ? "bg-green-50 text-green-700" :
                                table.status === "paid" ? "bg-stone-100 text-stone-600" :
                                "bg-stone-50 text-stone-400"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(table.status)}`} />
                                {getStatusLabel(table.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-stone-600">{table.guests || "—"}</td>
                            <td className="px-4 py-3 font-bold text-stone-800">{table.amount ? `₹${table.amount.toLocaleString()}` : "—"}</td>
                            <td className="px-4 py-3 text-stone-500">{table.startTime || "—"}</td>
                            <td className="px-4 py-3 text-stone-600">{table.waiter || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              {table.status !== "blank" && (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePrintBill(table); }}
                                    className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="Print Bill"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedTable(table); }}
                                    className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="View Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Detail Slide-Over Panel */}
      {selectedTable && selectedTable.status !== "blank" && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 animate-fade-in" onClick={() => setSelectedTable(null)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
            {/* Panel Header */}
            <div className="p-5 border-b border-stone-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-stone-800">{selectedTable.no} — {sections.find(s => s.tables.some(t => t.id === selectedTable.id))?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md ${
                    selectedTable.status === "running" ? "bg-blue-50 text-blue-700" :
                    selectedTable.status === "kot" ? "bg-yellow-50 text-yellow-700" :
                    selectedTable.status === "printed" ? "bg-green-50 text-green-700" :
                    "bg-stone-100 text-stone-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(selectedTable.status)}`} />
                    {getStatusLabel(selectedTable.status)}
                  </span>
                  {selectedTable.orderType && (
                    <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">{selectedTable.orderType}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedTable(null)} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-stone-100 shrink-0">
              <div className="bg-stone-50 rounded-xl p-3 text-center">
                <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-stone-800">{selectedTable.guests || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase font-bold">Items</p>
              </div>
              <div className="bg-stone-50 rounded-xl p-3 text-center">
                <IndianRupee className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-stone-800">₹{selectedTable.amount?.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400 uppercase font-bold">Amount</p>
              </div>
              <div className="bg-stone-50 rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-stone-800">{selectedTable.startTime || "—"}</p>
                <p className="text-[10px] text-stone-400 uppercase font-bold">Since</p>
              </div>
            </div>

            {/* Waiter Info */}
            <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                {selectedTable.waiter?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">{selectedTable.waiter}</p>
                <p className="text-[10px] text-stone-400 uppercase font-bold">Ordered By</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="flex-1 overflow-y-auto p-5">
              <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Order Items
              </h4>
              <div className="space-y-2">
                {selectedTable.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                    <div className="flex-1">
                      <p className="font-semibold text-stone-800 text-sm">{item.name}</p>
                      <p className="text-xs text-stone-400">₹{item.price} × {item.qty}</p>
                    </div>
                    <p className="font-bold text-stone-800">₹{(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
                {(!selectedTable.items || selectedTable.items.length === 0) && (
                  <p className="text-sm text-stone-400 text-center py-4">No items in this order</p>
                )}
              </div>
              {selectedTable.items && selectedTable.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-stone-200 flex justify-between">
                  <span className="font-bold text-stone-600">Total</span>
                  <span className="text-xl font-black text-stone-900">₹{selectedTable.amount?.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Action Buttons — ALL functional */}
            <div className="p-5 border-t border-stone-200 space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSendKOT(selectedTable)}
                  className="flex items-center justify-center gap-2 py-3 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl font-bold text-sm hover:bg-yellow-100 transition-colors"
                >
                  <ChefHat className="w-4 h-4" /> 🔥 Send KOT
                </button>
                <button
                  onClick={() => handlePrintBill(selectedTable)}
                  className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors"
                >
                  <Printer className="w-4 h-4" /> 🧾 Print Bill
                </button>
              </div>
              <button
                onClick={() => handlePaymentReceived(selectedTable)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> ✅ Payment Received
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
