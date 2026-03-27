/**
 * Production-safe logger.
 * In production builds, suppresses detailed error info to prevent information leakage.
 * In development, provides full logging.
 */

const IS_PRODUCTION = import.meta.env.PROD;

export const logger = {
  error(context: string, error?: unknown) {
    if (IS_PRODUCTION) {
      // Log minimal info — no stack traces, no internal details
      console.error(`[${context}] An error occurred`);
    } else {
      console.error(`[${context}]`, error);
    }
  },

  warn(context: string, ...args: unknown[]) {
    if (!IS_PRODUCTION) {
      console.warn(`[${context}]`, ...args);
    }
  },

  info(context: string, ...args: unknown[]) {
    if (!IS_PRODUCTION) {
      console.log(`[${context}]`, ...args);
    }
  },

  /**
   * Returns a safe error message for display to users.
   * Never exposes internal error details.
   */
  safeMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
    if (error instanceof Error) {
      // Only pass through known safe error messages
      const safePatterns = [
        /payment/i,
        /order/i,
        /cart/i,
        /unavailable/i,
        /invalid/i,
        /try again/i,
      ];
      if (safePatterns.some((p) => p.test(error.message))) {
        return error.message;
      }
    }
    return fallback;
  },
};
