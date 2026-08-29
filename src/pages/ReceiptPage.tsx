import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  Loader2,
  ArrowLeft,
  Download,
  Share2,
  CheckCircle2,
  Receipt,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { Bill } from "../types";

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trackingToken = searchParams.get("token");
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    // Bills are keyed by orderId
    const unsubscribe = onSnapshot(
      doc(db, "bills", orderId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Gate access with the tracking token (same as the order page).
          if (data.trackingToken && data.trackingToken !== trackingToken) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
          setBill({ id: docSnap.id, ...data } as Bill);
          setNotFound(false);
        } else {
          // Bill may not be generated yet (trigger is async), retry via listener
          setNotFound(true);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching bill:", error);
        setLoading(false);
        setNotFound(true);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!bill) return;

    const shareText = [
      `🧾 DineQR Receipt — ${bill.billNumber}`,
      `📅 ${bill.createdAt?.toDate?.()
        ? bill.createdAt.toDate().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : ""}`,
      `🪑 Table: ${bill.tableNumber}`,
      `👤 ${bill.customerName}`,
      ``,
      ...bill.items.map(
        (i) => `  ${i.quantity}× ${i.name} — ₹${i.subtotal}`
      ),
      ``,
      `  Subtotal: ₹${bill.subtotal}`,
      `  GST (${bill.gstRate}%): ₹${bill.gstAmount}`,
      `  ──────────`,
      `  Total: ₹${bill.total}`,
      ``,
      `💳 ${bill.paymentMethod === "cash" ? "Cash" : "Online"} — ${bill.paymentStatus === "paid" ? "Paid ✅" : "Pending"}`,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `DineQR Receipt — ${bill.billNumber}`,
          text: shareText,
          url: window.location.href,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast.error("Failed to share. Copied to clipboard instead.");
          await navigator.clipboard.writeText(shareText);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Receipt copied to clipboard!");
      } catch {
        toast.error("Unable to share or copy.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-stone-500 font-medium">Loading your receipt...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold text-stone-800">Access Denied</h2>
        <p className="text-stone-500 max-w-xs">
          You don't have permission to view this receipt.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 px-6 py-2 bg-stone-800 text-white font-medium rounded-full hover:bg-stone-900 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (notFound || !bill) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
          <Receipt className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-stone-800">
          Generating your receipt...
        </h2>
        <p className="text-stone-500 max-w-xs">
          Your bill is being prepared. This usually takes a few seconds.
        </p>
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const formattedDate = bill.createdAt?.toDate?.()
    ? bill.createdAt.toDate().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const formattedTime = bill.createdAt?.toDate?.()
    ? bill.createdAt.toDate().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      {/* Header — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              navigate(
                trackingToken
                  ? `/order/${orderId}?token=${trackingToken}`
                  : "/"
              )
            }
            className="p-2 bg-white rounded-full shadow-sm border border-stone-200 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-stone-800">Receipt</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2.5 bg-white rounded-xl border border-stone-200 shadow-sm text-stone-600 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
            title="Share Receipt"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Receipt Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
        {/* ─── Receipt Header ─── */}
        <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 text-white p-6 text-center print:bg-white print:text-black print:border-b print:border-stone-300">
          <h2 className="text-2xl font-bold tracking-tight print:text-black">
            DineQR
          </h2>
          <p className="text-emerald-200 text-sm mt-1 print:text-stone-500">
            Thank you for dining with us!
          </p>
        </div>

        {/* ─── Bill Info ─── */}
        <div className="px-6 pt-5 pb-3 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                Bill No.
              </p>
              <p className="font-bold text-stone-800 text-lg font-mono">
                {bill.billNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                Date
              </p>
              <p className="font-medium text-stone-700">{formattedDate}</p>
              <p className="text-sm text-stone-500">{formattedTime}</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-dashed border-stone-200">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                  Table
                </p>
                <p className="font-black text-emerald-800 text-xl print:text-black">
                  {bill.tableNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                  Customer
                </p>
                <p className="font-medium text-stone-700">
                  {bill.customerName}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                bill.orderType === "parcel"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {bill.orderType === "parcel" ? "Parcel" : "Dine-In"}
            </span>
          </div>
        </div>

        {/* ─── Items Table ─── */}
        <div className="px-6 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                <th className="pb-2 text-left font-bold">Item</th>
                <th className="pb-2 text-center font-bold">Qty</th>
                <th className="pb-2 text-right font-bold">Price</th>
                <th className="pb-2 text-right font-bold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bill.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 text-stone-800 font-medium">
                    {item.name}
                  </td>
                  <td className="py-3 text-center text-stone-600">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right text-stone-600">
                    ₹{item.unitPrice}
                  </td>
                  <td className="py-3 text-right font-medium text-stone-800">
                    ₹{item.subtotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── Totals ─── */}
        <div className="px-6 pb-6 space-y-2">
          <div className="border-t-2 border-dashed border-stone-200 pt-4 space-y-2">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span className="font-medium">₹{bill.subtotal}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>GST ({bill.gstRate}%)</span>
              <span className="font-medium">₹{bill.gstAmount}</span>
            </div>
            <div className="flex justify-between text-stone-900 text-xl font-black border-t-2 border-stone-200 pt-3 mt-2">
              <span>Total</span>
              <span className="text-emerald-700 print:text-black">
                ₹{bill.total}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Payment Info ─── */}
        <div className="px-6 pb-6">
          <div
            className={`p-4 rounded-xl text-center ${
              bill.paymentStatus === "paid"
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              {bill.paymentStatus === "paid" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5 text-amber-600" />
              )}
              <span
                className={`font-bold ${
                  bill.paymentStatus === "paid"
                    ? "text-emerald-800"
                    : "text-amber-800"
                }`}
              >
                {bill.paymentStatus === "paid"
                  ? "Payment Successful"
                  : "Cash — Pay at Counter"}
              </span>
            </div>
            <p className="text-sm text-stone-500">
              Method:{" "}
              <span className="font-medium capitalize">
                {bill.paymentMethod === "cash" ? "Cash" : "Online (UPI)"}
              </span>
            </p>
            {bill.razorpayPaymentId && (
              <p className="text-xs text-stone-400 mt-1 font-mono">
                Payment ID: {bill.razorpayPaymentId}
              </p>
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="bg-stone-50 px-6 py-4 text-center border-t border-stone-100 print:bg-white">
          <p className="text-sm text-stone-500">
            Thank you for your visit! We hope to see you again soon.
          </p>
          <p className="text-xs text-stone-400 mt-1 font-mono">
            Order ID: {bill.orderId}
          </p>
        </div>
      </div>

      {/* Action Buttons — visible on mobile, hidden in print */}
      <div className="flex gap-3 print:hidden">
        <button
          onClick={() =>
            navigate(
              trackingToken
                ? `/order/${orderId}?token=${trackingToken}`
                : "/"
            )
          }
          className="flex-1 py-3.5 bg-white border border-stone-200 text-stone-700 font-medium rounded-xl hover:bg-stone-50 transition-colors shadow-sm text-center"
        >
          Track Order
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-3.5 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share Receipt
        </button>
      </div>
    </div>
  );
}
