// ── Multi-tenant (Phase 3) types ──────────────────────────────

export type Role = "admin" | "staff" | "cook";

/** Custom claims carried on a Firebase Auth user's ID token. */
export interface TenantClaims {
  /** Restaurant the user belongs to (staff/cook/admin). */
  restaurantId?: string;
  role?: Role;
  /** Provider-team super-admin — access across all restaurants. */
  platformAdmin?: boolean;
}

export interface RestaurantBranding {
  primaryColor?: string;
  logoUrl?: string;
}

export interface RestaurantSubscription {
  plan: "trial" | "basic" | "pro";
  status: "active" | "past_due" | "cancelled";
  renewsAt?: unknown; // Firestore Timestamp
}

/** A tenant. Lives at `restaurants/{id}`. */
export interface Restaurant {
  id: string;
  name: string;
  address?: string;
  /** GST percent applied to orders, e.g. 5. */
  gstRate: number;
  timezone?: string;
  branding?: RestaurantBranding;
  /** Restaurant's OWN Razorpay key id (public). Secret lives server-side. */
  razorpayKeyId?: string | null;
  status: "active" | "suspended";
  subscription?: RestaurantSubscription;
  createdAt?: unknown; // Firestore Timestamp
}
