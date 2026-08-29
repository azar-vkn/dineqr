import type { UserRole } from "../types";

/**
 * The daily revenue report is now sent server-side by the `dailyRevenueReport`
 * scheduled Cloud Function (runs at 23:00 IST), so it no longer depends on an
 * admin having the dashboard open at 11 PM.
 *
 * This hook is kept as a no-op so existing callers (AdminLayout) don't need to
 * change. It intentionally does nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDailyReport(_role: UserRole | null): void {
  // no-op — see functions/src/index.ts → dailyRevenueReport
}
