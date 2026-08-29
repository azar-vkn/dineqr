// ============================================================
// Environment Variable Validation — Dev Mode Only
// Warns about missing configuration at startup
// ============================================================

interface EnvVar {
  key: string;
  label: string;
  required: boolean;
}

const ENV_VARS: EnvVar[] = [
  { key: "VITE_RAZORPAY_KEY_ID", label: "Razorpay Key ID (online payments)", required: false },
  { key: "VITE_RECAPTCHA_SITE_KEY", label: "reCAPTCHA Site Key (bot protection)", required: false },
  { key: "VITE_ADMIN_EMAIL", label: "Bootstrap Admin Email", required: false },
  { key: "VITE_EMAILJS_SERVICE_ID", label: "EmailJS Service ID (email reports)", required: false },
  { key: "VITE_EMAILJS_TEMPLATE_ID", label: "EmailJS Template ID", required: false },
  { key: "VITE_EMAILJS_PUBLIC_KEY", label: "EmailJS Public Key", required: false },
];

export function checkEnvironment(): void {
  // Only run in development mode
  if (!import.meta.env.DEV) return;

  const missing: string[] = [];
  const env = import.meta.env;

  for (const { key, label } of ENV_VARS) {
    if (!env[key]) {
      missing.push(`  • ${key} — ${label}`);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[DineQR] Missing environment variables (set in .env.local):\n${missing.join("\n")}\n` +
      `\nThe app will still run, but some features may be disabled.`
    );
  }
}
