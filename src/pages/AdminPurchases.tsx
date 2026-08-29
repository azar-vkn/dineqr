import { useState, useRef, useEffect } from "react";
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import {
  ArrowUpRight, ArrowDownRight, Package, Receipt, Users, Upload, Calendar as CalendarIcon,
  ChevronDown, Download, X, FileText, Check, AlertCircle, Eye, Trash2, Search, Plus, Loader2
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import type { Purchase, InvoiceStatus } from "../types";

export default function AdminPurchases() {
  const [invoices, setInvoices] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Invoice Wise");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedItem, setSelectedItem] = useState("All Items");
  const [selectedSupplier, setSelectedSupplier] = useState("All Suppliers");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for the Add New Bill modal
  const [formSupplier, setFormSupplier] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formTax, setFormTax] = useState("");
  const [formItems, setFormItems] = useState("");

  // ─── Real-time Firestore listener ───────────────────────────
  useEffect(() => {
    const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Purchase[] = [];
        snapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() } as Purchase);
        });
        setInvoices(fetched);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, "purchases");
      }
    );
    return () => unsubscribe();
  }, []);

  // ─── Add New Bill ───────────────────────────────────────────
  const handleSaveBill = async () => {
    if (!formSupplier.trim() || !formDate || !formAmount) {
      toast.error("Please fill in Supplier, Date, and Amount.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "purchases"), {
        supplier: formSupplier.trim(),
        date: formDate,
        amount: Number(formAmount) || 0,
        tax: Number(formTax) || 0,
        items: Number(formItems) || 0,
        status: "pending" as InvoiceStatus,
        fileName: uploadedFile?.name || null,
        createdAt: serverTimestamp(),
      });
      toast.success("Bill saved successfully!");
      resetModal();
    } catch (error) {
      toast.error("Failed to save bill. Please try again.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Invoice ─────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteDoc(doc(db, "purchases", id));
      toast.success("Invoice deleted.");
    } catch (error) {
      toast.error("Failed to delete invoice.");
      console.error(error);
    }
  };

  // ─── Mark as Reviewed ───────────────────────────────────────
  const handleMarkReviewed = async (id: string) => {
    try {
      await updateDoc(doc(db, "purchases", id), { status: "reviewed" });
      toast.success("Invoice marked as reviewed.");
    } catch (error) {
      toast.error("Failed to update invoice.");
      console.error(error);
    }
  };

  const resetModal = () => {
    setShowUploadModal(false);
    setUploadedFile(null);
    setFormSupplier("");
    setFormDate("");
    setFormAmount("");
    setFormTax("");
    setFormItems("");
  };

  // ─── Computed values ────────────────────────────────────────
  const reviewed = invoices.filter(i => i.status === "reviewed").length;
  const pending = invoices.filter(i => i.status === "pending").length;
  const rejected = invoices.filter(i => i.status === "rejected").length;
  const total = invoices.length;
  const totalPayable = invoices.reduce((s, i) => s + (i.amount || 0) + (i.tax || 0), 0);
  const totalTax = invoices.reduce((s, i) => s + (i.tax || 0), 0);
  const totalItems = invoices.reduce((s, i) => s + (i.items || 0), 0);
  const uniqueSuppliers = [...new Set(invoices.map(i => i.supplier).filter(Boolean))];

  // Filter invoices by search
  const filteredInvoices = searchQuery
    ? invoices.filter(i =>
        (i.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.supplier || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : invoices;

  // ─── Export CSV ─────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      toast.error("No invoices to export.");
      return;
    }
    const header = ["Invoice ID", "Supplier", "Date", "Amount", "Tax", "Total", "Items", "Status"];
    const rows = filteredInvoices.map((inv) => [
      inv.id,
      inv.supplier,
      inv.date ? new Date(inv.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "",
      inv.amount,
      inv.tax,
      (inv.amount || 0) + (inv.tax || 0),
      inv.items,
      inv.status,
    ]);
    const csvContent = [
      header.join(","),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dineqr-purchases-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  // ─── Chart data (computed from live invoices) ───────────────
  const invoiceWiseData = (() => {
    const weeks: Record<string, { tax: number; beforeTax: number; invoices: number }> = {};
    invoices.forEach((inv) => {
      if (!inv.date) return;
      const d = new Date(inv.date);
      const weekNum = Math.ceil(d.getDate() / 7);
      const label = `Week ${weekNum}`;
      if (!weeks[label]) weeks[label] = { tax: 0, beforeTax: 0, invoices: 0 };
      weeks[label].tax += inv.tax || 0;
      weeks[label].beforeTax += inv.amount || 0;
      weeks[label].invoices += 1;
    });
    return Object.entries(weeks).map(([label, data]) => ({ label, ...data }));
  })();

  const supplierWiseData = (() => {
    const suppliers: Record<string, { tax: number; beforeTax: number; invoices: number }> = {};
    invoices.forEach((inv) => {
      const label = inv.supplier || "Unknown";
      if (!suppliers[label]) suppliers[label] = { tax: 0, beforeTax: 0, invoices: 0 };
      suppliers[label].tax += inv.tax || 0;
      suppliers[label].beforeTax += inv.amount || 0;
      suppliers[label].invoices += 1;
    });
    return Object.entries(suppliers).map(([label, data]) => ({ label, ...data }));
  })();

  const getSummaryData = () => {
    switch (activeTab) {
      case "Supplier Wise": return supplierWiseData;
      default: return invoiceWiseData;
    }
  };

  const statCards = [
    { title: "Total Payable", value: `₹${totalPayable.toLocaleString()}`, trend: totalTax > 0 ? `Tax: ₹${totalTax.toLocaleString()}` : "No tax", trendPositive: true, sub: `Tax: ₹${totalTax.toLocaleString()}` },
    { title: "Total Items", value: String(totalItems), trend: `${totalItems} tracked`, trendPositive: true, sub: "Across all invoices" },
    { title: "Total Suppliers", value: String(uniqueSuppliers.length), trend: `${uniqueSuppliers.length} active`, trendPositive: true, sub: "Active vendors" },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const chartData = getSummaryData();

  // ─── Loading State ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold text-stone-800">Purchases & Invoices</h2>
          <p className="text-sm text-stone-500 font-medium">Loading...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
          <p className="text-stone-400 font-medium">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      {/* Dashboard Top Area */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Purchases & Invoices</h2>
          <p className="text-sm text-stone-500 font-medium">Welcome Back, Admin!</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
            />
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Bill
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Summary of Invoices Uploaded */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-sm font-bold text-stone-700 mb-4">Summary of Invoices Uploaded</h3>
            {total > 0 ? (
              <div className="w-full h-8 flex rounded-xl overflow-hidden shadow-inner mb-4">
                {reviewed > 0 && <div className="bg-emerald-400 flex items-center justify-center text-emerald-900 font-bold text-sm" style={{ width: `${(reviewed / total) * 100}%` }}>{reviewed}</div>}
                {pending > 0 && <div className="bg-amber-400 flex items-center justify-center text-amber-900 font-bold text-sm" style={{ width: `${(pending / total) * 100}%` }}>{pending}</div>}
                {rejected > 0 && <div className="bg-rose-400 flex items-center justify-center text-rose-900 font-bold text-sm" style={{ width: `${(rejected / total) * 100}%` }}>{rejected}</div>}
              </div>
            ) : (
              <div className="w-full h-8 flex rounded-xl overflow-hidden shadow-inner mb-4 bg-stone-100 items-center justify-center">
                <span className="text-xs text-stone-400">No invoices yet</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-6 text-xs font-semibold text-stone-600">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Reviewed ({reviewed})</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending ({pending})</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Rejected ({rejected})</div>
            </div>
          </div>

          {statCards.map((stat) => (
            <div key={stat.title} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-stone-500">{stat.title}</h3>
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${stat.trendPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                    {stat.trendPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </div>
                </div>
                <div className="text-2xl font-black text-stone-800">{stat.value}</div>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-100 font-medium text-sm text-stone-500">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts Row — the "Item-wise Rate Points" chart was removed (it plotted
            hardcoded Tomatoes/Paneer/Chicken/Rice placeholder rates, not real
            data). Rebuild it only once item-level purchase rates are captured. */}
        <div className="grid grid-cols-1 gap-6">
          {/* Summary View with tab-specific data */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-800">Summary View</h3>
              <button onClick={handleExportCSV} className="text-stone-400 hover:text-stone-600 transition-colors"><Download className="w-5 h-5" /></button>
            </div>
            <div className="flex border-b border-stone-200 mb-6">
              {["Invoice Wise", "Supplier Wise"].map(tab => (
                <button
                  key={tab}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-amber-400 text-stone-800" : "border-transparent text-stone-500 hover:text-stone-700"}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} tickFormatter={(val) => `₹${val / 1000}k`} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 25px -5px rgba(0,0,0,0.1)", fontWeight: 600, padding: "10px 16px" }}
                      formatter={(value: any, name: any) => [name.includes("Invoices") ? value : `₹${value.toLocaleString()}`, name]}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
                    <Bar yAxisId="left" dataKey="tax" name="Tax Amount" stackId="a" fill="#34D399" barSize={30} radius={[0, 0, 4, 4]} />
                    <Bar yAxisId="left" dataKey="beforeTax" name="Before Taxes" stackId="a" fill="#FDE68A" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="invoices" name="No. of Invoices" stroke="#F43F5E" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#F43F5E" }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-400 font-medium">
                  No data to display. Add invoices to see charts.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice List Table */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-800">All Invoices ({filteredInvoices.length})</h3>
            <button onClick={handleExportCSV} className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-700 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Tax</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-center px-4 py-3 font-medium">Items</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center">
                          <FileText className="w-7 h-7 text-stone-300" />
                        </div>
                        <p className="text-stone-500 font-semibold">No invoices found</p>
                        <p className="text-stone-400 text-sm">Click "Add New Bill" to create one.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3 text-stone-700 font-medium">{inv.supplier}</td>
                      <td className="px-4 py-3 text-stone-500">{inv.date ? new Date(inv.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                      <td className="px-4 py-3 text-right text-stone-800">₹{(inv.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-stone-500">₹{(inv.tax || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-stone-800">₹{((inv.amount || 0) + (inv.tax || 0)).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-stone-600">{inv.items || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${
                          inv.status === "reviewed" ? "bg-emerald-50 text-emerald-700" :
                          inv.status === "pending" ? "bg-amber-50 text-amber-700" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {inv.status === "reviewed" ? <Check className="w-3 h-3" /> :
                           inv.status === "pending" ? <AlertCircle className="w-3 h-3" /> :
                           <X className="w-3 h-3" />}
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "pending" && (
                            <button
                              onClick={() => handleMarkReviewed(inv.id)}
                              className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Mark as Reviewed"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredInvoices.length > 0 && (
                <tfoot className="bg-stone-50 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-stone-700">Totals</td>
                    <td className="px-4 py-3 text-right text-stone-800">₹{invoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-stone-500">₹{totalTax.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-stone-800">₹{totalPayable.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-stone-600">{totalItems}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Upload Bill Modal */}
      {showUploadModal && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={resetModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-fade-in-up">
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-800">Add New Bill</h3>
                <button onClick={resetModal} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center">
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {/* File Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-300 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadedFile ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto bg-emerald-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-emerald-600" />
                      </div>
                      <p className="font-bold text-stone-800">{uploadedFile.name}</p>
                      <p className="text-xs text-stone-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto bg-stone-100 rounded-xl flex items-center justify-center">
                        <Upload className="w-6 h-6 text-stone-400" />
                      </div>
                      <p className="font-bold text-stone-700">Drag & drop or click to upload</p>
                      <p className="text-xs text-stone-400">Supports PDF, JPG, PNG, XLSX — Max 10MB (optional)</p>
                    </div>
                  )}
                </div>

                {/* Bill Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">Bought From (Supplier) *</label>
                    <input
                      type="text"
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Fresh Farms Ltd"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">Invoice Date *</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">Amount (₹) *</label>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="12500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">Tax Amount (₹)</label>
                    <input
                      type="number"
                      value={formTax}
                      onChange={(e) => setFormTax(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="2250"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">No. of Items</label>
                    <input
                      type="number"
                      value={formItems}
                      onChange={(e) => setFormItems(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="15"
                    />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-stone-200 flex justify-end gap-3">
                <button onClick={resetModal} className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={handleSaveBill}
                  disabled={saving || !formSupplier.trim() || !formDate || !formAmount}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                    formSupplier.trim() && formDate && formAmount
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Saving..." : "Save Bill"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
