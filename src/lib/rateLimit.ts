import { RATE_LIMIT } from "./constants";

const STORAGE_KEY = "dineqr_order_timestamps";

/**
 * Token-bucket rate limiter using localStorage.
 * Limits order submissions to MAX_ORDERS per WINDOW_MS.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkOrderRateLimit(): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const now = Date.now();
  let timestamps: number[] = [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      timestamps = JSON.parse(stored);
    }
  } catch {
    // Corrupted data — reset
    timestamps = [];
  }

  // Remove expired timestamps outside the window
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT.WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT.MAX_ORDERS) {
    // Calculate when the oldest entry in the window expires
    const oldestInWindow = Math.min(...timestamps);
    const retryAfterMs = RATE_LIMIT.WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  // Record this attempt
  timestamps.push(now);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
  } catch {
    // localStorage full or unavailable — allow the order anyway
  }

  return { allowed: true };
}

/**
 * Returns a human-readable cooldown string, e.g., "2m 30s"
 */
export function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
