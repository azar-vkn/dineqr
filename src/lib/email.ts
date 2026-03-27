import emailjs from '@emailjs/browser';

// ==========================================
// EMAILJS CONFIGURATION
// Credentials loaded from environment variables for security.
// Set these in .env.local (never commit real values)
// ==========================================
const EMAILJS_SERVICE_ID =
  (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID =
  (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || "";
const EMAILJS_PUBLIC_KEY =
  (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || "";

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
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    throw new Error("Email service not configured. Please set EmailJS environment variables.");
  }

  const templateParams = {
    to_email: toEmail || "admin@example.com",
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
    // Don't log full error details in production
    if (import.meta.env.DEV) {
      console.error("Failed to send email report:", error);
    }
    throw new Error("Failed to send email report. Please try again later.");
  }
};
