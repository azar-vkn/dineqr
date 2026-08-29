// ============================================================
// Centralized Application Constants
// Move all hardcoded values here for security and maintainability
// ============================================================

/**
 * Bootstrap admin email — the primary administrator account.
 * Read from environment variable with fallback.
 * This should be the ONLY place this email appears in the codebase.
 */
export const BOOTSTRAP_ADMIN_EMAIL: string =
  (import.meta as any).env?.VITE_ADMIN_EMAIL || "asirselvin446@gmail.com";

/**
 * Application metadata
 */
export const APP_NAME = "DineQR";
export const APP_DESCRIPTION = "Smart QR-based restaurant ordering system";

/**
 * Order validation limits (must match firestore.rules)
 */
export const ORDER_LIMITS = {
  MAX_ITEMS: 50,
  MAX_QUANTITY_PER_ITEM: 50,
  MAX_TOTAL: 1_000_000, // ₹10,00,000
  MAX_TABLE_NUMBER_LENGTH: 20,
  MAX_CUSTOMER_NAME_LENGTH: 100,
} as const;

/**
 * GST / tax rate applied to customer orders (display side).
 * NOTE: the *authoritative* order total is computed server-side in the Cloud
 * Functions; these constants only keep the client UI consistent and in one
 * place. If you change the rate, update the Cloud Function too.
 */
export const GST_RATE = 0.05;
export const GST_MULTIPLIER = 1 + GST_RATE; // 1.05
export const GST_PERCENT = Math.round(GST_RATE * 100); // 5

/**
 * Rate limiting config
 */
export const RATE_LIMIT = {
  MAX_ORDERS: 3,
  WINDOW_MS: 5 * 60 * 1000, // 5 minutes
} as const;
