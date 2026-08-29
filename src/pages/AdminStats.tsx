import { useState } from "react";
import { Loader2, TrendingUp, IndianRupee, ShoppingBag, Users, Utensils, Send, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { sendRevenueReport, ReportStats } from "../lib/email";
import { useOrders } from "../hooks/useOrders";
import StatCard from "../components/StatCard";
import { StatsSkeleton } from "../components/Skeletons";
import type { Order } from "../types";
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
  Legend,
  Area,
  AreaChart,
} from "recharts";

const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

export default function AdminStats() {
  const { orders, loading } = useOrders({ maxOrders: 500, direction: "desc" });
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("today");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [chartTab, setChartTab] = useState<"revenue" | "orders">("revenue");

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        <header>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Revenue & Statistics</h1>
          <p className="text-stone-400 mt-1 text-sm">Track your restaurant's performance and sales.</p>
        </header>
        <StatsSkeleton />
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
  const uniqueTables = new Set(completedOrders.map(o => o.tableNumber)).size;
  const cancelledCount = filteredOrders.filter(o => o.status === "cancelled").length;

  // Prepare data for Revenue Chart
  const revenueDataMap = new Map<string, { revenue: number; orders: number }>();
  completedOrders.forEach(order => {
    if (!order.createdAt?.toDate) return;
    const date = order.createdAt.toDate();
    let key = "";
    if (timeRange === "today") {
      key = `${date.getHours()}:00`;
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const existing = revenueDataMap.get(key) || { revenue: 0, orders: 0 };
    revenueDataMap.set(key, { revenue: existing.revenue + order.total, orders: existing.orders + 1 });
  });
  const revenueChartData = Array.from(revenueDataMap.entries())
    .map(([name, data]) => ({ name, revenue: data.revenue, orders: data.orders }))
    .reverse();

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
    .slice(0, 5);

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
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Revenue & Statistics</h1>
          <p className="text-stone-400 mt-1 text-sm">Track your restaurant's performance and sales.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-200/50 active:scale-95"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Email Report
          </button>
          
          <div className="flex bg-white rounded-xl border border-stone-200 p-1 shadow-sm">
            {(["today", "week", "month", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${
                  timeRange === range 
                    ? "bg-emerald-600 text-white shadow-sm" 
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          subtitle="Completed orders only"
          icon={IndianRupee}
          iconBgColor="bg-emerald-100"
          iconTextColor="text-emerald-600"
          accentBarColor="bg-emerald-500"
          animationDelay={0}
          accent={
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-semibold">Completed orders only</span>
            </span>
          }
        />
        <StatCard
          title="Total Orders"
          value={totalOrdersCount}
          subtitle={`${cancelledCount} cancelled`}
          icon={ShoppingBag}
          iconBgColor="bg-blue-100"
          iconTextColor="text-blue-600"
          accentBarColor="bg-blue-500"
          animationDelay={75}
        />
        <StatCard
          title="Average Order"
          value={`₹${averageOrderValue.toLocaleString()}`}
          subtitle="Per completed order"
          icon={Utensils}
          iconBgColor="bg-amber-100"
          iconTextColor="text-amber-600"
          accentBarColor="bg-amber-500"
          animationDelay={150}
        />
        <StatCard
          title="Tables Served"
          value={uniqueTables}
          subtitle="Unique tables"
          icon={Users}
          iconBgColor="bg-purple-100"
          iconTextColor="text-purple-600"
          accentBarColor="bg-purple-500"
          animationDelay={225}
        />
      </div>

      {/* Revenue & Expense Summary (Inspired by Image 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in-up delay-200">
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-stone-400 font-medium">Revenue</p>
              <p className="text-2xl font-black text-emerald-700">₹{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <ArrowDownRight className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-stone-400 font-medium">Cancelled Value</p>
              <p className="text-2xl font-black text-red-600">
                ₹{filteredOrders.filter(o => o.status === "cancelled").reduce((s, o) => s + o.total, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-stone-400 font-medium">Net Revenue</p>
              <p className="text-2xl font-black text-stone-900">₹{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue Trend Chart — with Gradient Fill */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm lg:col-span-2 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-stone-800">Revenue Trend</h3>
            <div className="flex bg-stone-100 rounded-lg p-0.5">
              <button
                onClick={() => setChartTab("revenue")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${chartTab === "revenue" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
              >
                Revenue
              </button>
              <button
                onClick={() => setChartTab("orders")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${chartTab === "orders" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
              >
                Orders
              </button>
            </div>
          </div>
          <div className="h-80 w-full">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(value) => chartTab === "revenue" ? `₹${value}` : String(value)} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 600 }}
                    formatter={(value: any) => [chartTab === "revenue" ? `₹${value}` : value, chartTab === "revenue" ? 'Revenue' : 'Orders']}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartTab === "revenue" ? "revenue" : "orders"}
                    stroke={chartTab === "revenue" ? "#059669" : "#3b82f6"}
                    strokeWidth={3}
                    fill={`url(#${chartTab === "revenue" ? "revenueGradient" : "ordersGradient"})`}
                    dot={{ r: 4, fill: chartTab === "revenue" ? '#059669' : '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400">
                <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-7 h-7 text-stone-300" />
                </div>
                <p className="font-medium">No revenue data for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Chart */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm animate-fade-in-up delay-300">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Payment Methods</h3>
          <div className="h-80 w-full">
            {paymentMethodsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {paymentMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : '#f59e0b'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)', fontWeight: 600, padding: '10px 16px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400">
                <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-3">
                  <IndianRupee className="w-7 h-7 text-stone-300" />
                </div>
                <p className="font-medium">No payment data</p>
              </div>
            )}
          </div>
        </div>

        {/* Popular Items Chart */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm animate-fade-in-up delay-300">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Top Selling Items</h3>
          <div className="h-80 w-full">
            {popularItemsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularItemsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }} width={120} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb', rx: 8 }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)', fontWeight: 600, padding: '10px 16px' }}
                    formatter={(value: any, name: any) => [value, name === 'count' ? 'Quantity Sold' : 'Revenue']}
                  />
                  <Bar dataKey="count" name="Quantity Sold" fill="#059669" radius={[0, 8, 8, 0]} barSize={28}>
                    {popularItemsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400">
                <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-3">
                  <ShoppingBag className="w-7 h-7 text-stone-300" />
                </div>
                <p className="font-medium">No sales data for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* NOTE: The "Profit & Loss" and "Cashflow" charts were removed — they
            rendered hardcoded Jan–Jun placeholder numbers presented as real
            analytics. Re-add them only when wired to real revenue/expense data
            (e.g. from bills + purchases). */}
      </div>
    </div>
  );
}
