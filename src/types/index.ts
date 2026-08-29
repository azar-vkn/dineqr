// ============================================================
// Shared Type Definitions for DineQR
// Single source of truth — import from "@/src/types" everywhere
// ============================================================

// ─── Order Status & Payment ─────────────────────────────────

export type OrderStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

export type PaymentStatus = "paid" | "failed" | "pending_collection";

export type PaymentMethod = "cash" | "upi";

// ─── Menu ───────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  isVeg?: boolean;
  spiceLevel?: number;
}

export type MenuCategory = "Starters" | "Main Course" | "Drinks" | "Desserts";

// ─── Orders ─────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  tableNumber: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  verificationToken?: string;
  trackingToken?: string;
  orderType?: 'dine' | 'parcel';
  orderSource?: 'customer' | 'staff';
  staffId?: string;
  staffName?: string;
  createdAt: any; // Firestore Timestamp
}

// ─── Bills ──────────────────────────────────────────────────

export interface BillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Bill {
  id: string;
  orderId: string;
  billNumber: string;
  tableNumber: string;
  customerName: string;
  orderType: 'dine' | 'parcel';
  items: BillItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  razorpayPaymentId?: string;
  createdAt: any; // Firestore Timestamp
}

// ─── User / Auth ────────────────────────────────────────────

export type UserRole = "admin" | "staff" | "cook";

export type StaffStatus = "active" | "inactive";

export interface AppUser {
  staffId: string;
  displayName: string;
  phone: string;
  email: string;
  role: UserRole;
  status: StaffStatus;
  createdAt: any; // Firestore Timestamp
}

// ─── Purchases / Invoices ───────────────────────────────────

export type InvoiceStatus = "reviewed" | "pending" | "rejected";

export interface Purchase {
  id: string;
  supplier: string;
  date: string;          // ISO date string "YYYY-MM-DD"
  amount: number;
  tax: number;
  items: number;
  status: InvoiceStatus;
  fileName?: string;
  createdAt: any;        // Firestore Timestamp
}

