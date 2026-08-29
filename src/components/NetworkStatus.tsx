import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

/**
 * Floating offline banner — appears when the network goes down,
 * disappears when it comes back. Matches DineQR's design language.
 */
export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in-up">
      <div className="flex items-center gap-3 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-700">
        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center shrink-0">
          <WifiOff className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold">You're offline</p>
          <p className="text-xs text-stone-400">Some features may be unavailable</p>
        </div>
      </div>
    </div>
  );
}
