import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Loader2, TrendingUp, IndianRupee, ShoppingBag, Users, Utensils, Send } from "lucide-react";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { sendRevenueReport, ReportStats } from "../lib/email";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

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

const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

export default function AdminStats() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("today");
  const [sendingEmail, setSendingEmail] = useState(false);

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
        <p className="text-stone-500 font-medium">Loading Statistics...</p>
      </div>
    );
  }

  // Filter orders based on time range
  const now = new Date();
  const filteredOrders = orders.filter(order => {
    if (!order.createdAt?.toDate) return false;
    const orderDate = order.createdAt.toDate();
    
    if (timeRange === "today") {
      return orderDate.toDateString() === now.toDateString();
    } else if (timeRange === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= weekAgo;
    } else if (timeRange === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= monthAgo;
    }
    return true;
  });

  // Calculate key metrics (excluding cancelled orders for revenue)
  const completedOrders = filteredOrders.filter(o => o.status !== "cancelled");
  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
  const totalOrdersCount = filteredOrders.length;
  const averageOrderValue = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;
  
  // Unique tables served
  const uniqueTables = new Set(completedOrders.map(o => o.tableNumber)).size;

  // Prepare data for Revenue Chart (Group by day or hour)
  const revenueDataMap = new Map<string, number>();
  completedOrders.forEach(order => {
    if (!order.createdAt?.toDate) return;
    const date = order.createdAt.toDate();
    let key = "";
    
    if (timeRange === "today") {
      key = `${date.getHours()}:00`;
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    revenueDataMap.set(key, (revenueDataMap.get(key) || 0) + order.total);
  });

  const revenueChartData = Array.from(revenueDataMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .reverse(); // Reverse to show chronological order

  // Prepare data for Popular Items Chart
  const itemSalesMap = new Map<string, { count: number, revenue: number }>();
  completedOrders.forEach(order => {
    order.items.forEach(item => {
      const current = itemSalesMap.get(item.name) || { count: 0, revenue: 0 };
      itemSalesMap.set(item.name, {
        count: current.count + item.quantity,
        revenue: current.revenue + (item.price * item.quantity)
      });
    });
  });

  const popularItemsData = Array.from(itemSalesMap.entries())
    .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 items

  // Prepare data for Payment Methods Chart
  const paymentMethodsMap = new Map<string, number>();
  completedOrders.forEach(order => {
    const method = order.paymentMethod === "cash" ? "Cash" : "Online";
    paymentMethodsMap.set(method, (paymentMethodsMap.get(method) || 0) + 1);
  });

  const paymentMethodsData = Array.from(paymentMethodsMap.entries())
    .map(([name, value]) => ({ name, value }));

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const stats: ReportStats = {
        period: timeRange === "today" ? new Date().toLocaleDateString() : `Last ${timeRange}`,
        totalRevenue,
        totalOrders: totalOrdersCount,
        completedOrders: completedOrders.length,
        cancelledOrders: filteredOrders.length - completedOrders.length,
        averageOrderValue,
        topItems: popularItemsData,
      };
      await sendRevenueReport(stats);
      toast.success("Revenue report sent successfully to your email!");
    } catch (error: any) {
      if (error.message?.includes("credentials not configured")) {
        toast.error("Please configure EmailJS credentials in src/lib/email.ts first.");
      } else {
        toast.error("Failed to send email. Check console for details.");
      }
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Revenue & Statistics</h1>
          <p className="text-stone-500 mt-1">Track your restaurant's performance and sales.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Email Report
          </button>
          
          <div className="flex bg-white rounded-xl border border-stone-200 p-1 shadow-sm">
            {(["today", "week", "month", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                  timeRange === range 
                    ? "bg-emerald-50 text-emerald-800" 
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-stone-500 font-medium">Total Revenue</h3>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-stone-900">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-stone-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-600 font-medium">Completed orders only</span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-stone-500 font-medium">Total Orders</h3>
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-stone-900">{totalOrdersCount}</p>
          <p className="text-sm text-stone-400 mt-2">
            {filteredOrders.filter(o => o.status === "cancelled").length} cancelled
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-stone-500 font-medium">Average Order</h3>
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-stone-900">₹{averageOrderValue.toLocaleString()}</p>
          <p className="text-sm text-stone-400 mt-2">Per completed order</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-stone-500 font-medium">Tables Served</h3>
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-stone-900">{uniqueTables}</p>
          <p className="text-sm text-stone-400 mt-2">Unique tables</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Revenue Trend</h3>
          <div className="h-80 w-full">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`₹${value}`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: '#059669', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400">
                No revenue data for this period
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Chart */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Payment Methods</h3>
          <div className="h-80 w-full">
            {paymentMethodsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : '#f59e0b'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400">
                No payment data
              </div>
            )}
          </div>
        </div>

        {/* Popular Items Chart */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm lg:col-span-3">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Top Selling Items</h3>
          <div className="h-80 w-full">
            {popularItemsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularItemsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} width={120} />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string) => [value, name === 'count' ? 'Quantity Sold' : 'Revenue']}
                  />
                  <Bar dataKey="count" name="Quantity Sold" fill="#059669" radius={[0, 4, 4, 0]} barSize={24}>
                    {popularItemsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400">
                No sales data for this period
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
