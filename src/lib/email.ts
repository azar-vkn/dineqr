import emailjs from '@emailjs/browser';

// ==========================================
// EMAILJS CONFIGURATION
// Create a free account at https://emailjs.com
// ==========================================
export const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
export const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
export const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";

export interface ReportStats {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  topItems: { name: string; count: number }[];
}

export const sendRevenueReport = async (stats: ReportStats, toEmail?: string) => {
  if (EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID") {
    throw new Error("EmailJS credentials not configured! Please open src/lib/email.ts and add your keys.");
  }

  const templateParams = {
    to_email: toEmail || "admin@example.com", // You can configure this in your EmailJS template instead
    report_period: stats.period,
    total_revenue: `₹${stats.totalRevenue.toLocaleString()}`,
    total_orders: stats.totalOrders,
    completed_orders: stats.completedOrders,
    cancelled_orders: stats.cancelledOrders,
    average_order: `₹${stats.averageOrderValue.toLocaleString()}`,
    top_items: stats.topItems.map(i => `${i.count}x ${i.name}`).join("\n") || "None",
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );
    return response;
  } catch (error) {
    console.error("Failed to send email report:", error);
    throw error;
  }
};
