import { ReactNode, useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, MenuSquare, QrCode, UtensilsCrossed,
  LogOut, Loader2, Users, TrendingUp, ClipboardList, Receipt,
  Menu, X, ChefHat, Calendar, LayoutGrid, Package, Mail, KeyRound
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { useDailyReport } from "../hooks/useDailyReport";
import { useUserRole } from "../hooks/useUserRole";

const electronAPI = (window as any).electronAPI as
  | { signInWithGoogle?: (config: { clientId: string; clientSecret?: string }) => Promise<string> }
  | undefined;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, role, loading } = useUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Initialize the background checker for daily reports (only runs if role === "admin")
  useDailyReport(role);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      if (electronAPI?.signInWithGoogle) {
        // Desktop: signInWithPopup can't work in Electron (window.open is denied),
        // so the main process runs Google's loopback OAuth flow instead.
        const clientId = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
        if (!clientId) {
          toast.error("Google sign-in isn't configured for desktop — use email login.");
          return;
        }
        const idToken = await electronAPI.signInWithGoogle({
          clientId,
          clientSecret: import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET,
        });
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
      toast.success("Logged in successfully");
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === "auth/popup-blocked") {
        toast.error("Popup blocked — please allow popups or use email login.");
      } else {
        toast.error("Failed to log in with Google");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Please enter email and password");
      return;
    }
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      toast.success("Logged in successfully");
    } catch (error: any) {
      console.error("Email login error:", error);
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        toast.error("Invalid email or password");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error("Failed to log in");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setShowResetForm(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Password reset error:", error);
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email");
      } else {
        toast.error("Failed to send reset email");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center animate-pulse-glow">
            <UtensilsCrossed className="w-7 h-7 text-emerald-600" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="text-stone-400 text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Password reset form
    if (showResetForm) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-emerald-50/30 to-stone-100 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-10 rounded-3xl shadow-xl border border-stone-200/60 max-w-md w-full text-center space-y-6 animate-fade-in-up">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-200">
              <KeyRound className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="font-black text-2xl text-stone-900 tracking-tight">Reset Password</h1>
              <p className="text-stone-400 text-sm mt-1">Enter your email to receive a reset link</p>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Email Address</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-stone-800"
                />
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold rounded-xl hover:from-amber-700 hover:to-amber-800 transition-all shadow-lg shadow-amber-200/50 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
            </form>
            <button
              onClick={() => { setShowResetForm(false); setResetEmail(""); }}
              className="text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors"
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      );
    }

    // Main login form
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-emerald-50/30 to-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-stone-200/60 max-w-md w-full text-center space-y-6 animate-fade-in-up">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
            <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="font-black text-2xl text-stone-900 tracking-tight">DineQR Admin</h1>
            <p className="text-stone-400 text-sm mt-1">Restaurant management dashboard</p>
          </div>

          {/* Email/Password Login */}
          <form onSubmit={handleEmailLogin} className="space-y-3 text-left">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-stone-800"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-stone-800"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg shadow-emerald-200/50 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <button
            onClick={() => { setShowResetForm(true); setResetEmail(loginEmail); }}
            className="text-sm text-stone-500 hover:text-emerald-700 font-medium transition-colors"
          >
            Forgot Password?
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-stone-200"></div>
            <span className="text-xs text-stone-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-stone-200"></div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-3.5 bg-white border-2 border-stone-200 text-stone-700 font-bold rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Waiting for browser…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-red-50/20 to-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-stone-200/60 max-w-md w-full text-center space-y-6 animate-fade-in-up">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-red-200">
            <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="font-black text-2xl text-red-700 tracking-tight">Access Denied</h1>
            <p className="text-stone-400 text-sm mt-1">Insufficient permissions</p>
          </div>
          <p className="text-stone-500 text-sm">You do not have permission to access the admin dashboard. Please sign in with an authorized staff or administrator account.</p>
          <p className="text-sm font-medium text-stone-800 bg-stone-100 py-2.5 px-4 rounded-xl">
            {user.email}
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3.5 bg-stone-800 text-white font-bold rounded-xl hover:bg-stone-900 transition-all active:scale-[0.98]"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  const links = [
    { name: "Live Orders", path: "/admin", icon: LayoutDashboard, roles: ["admin", "staff"] },
    { name: "POS & Tables", path: "/admin/pos", icon: LayoutGrid, roles: ["admin", "staff"] },
    { name: "Menu Management", path: "/admin/menu", icon: MenuSquare, roles: ["admin"] },
    { name: "QR Codes", path: "/admin/qr", icon: QrCode, roles: ["admin", "staff"] },
    { name: "Staff Management", path: "/admin/staff", icon: Users, roles: ["admin"] },
    { name: "Invoices & Purchases", path: "/admin/purchases", icon: Package, roles: ["admin"] },
    { name: "Revenue & Stats", path: "/admin/stats", icon: TrendingUp, roles: ["admin"] },
    { name: "Order History", path: "/admin/history", icon: ClipboardList, roles: ["admin", "staff"] },
    { name: "Billing", path: "/admin/billing", icon: Receipt, roles: ["admin"] },
  ].filter(link => link.roles.includes(role));

  if (role === "cook") {
    if (location.pathname !== "/admin/kitchen") {
      return <Navigate to="/admin/kitchen" replace />;
    }
    
    // For cooks, return a distraction-free layout (no sidebar)
    return (
      <div className="min-h-screen bg-stone-900 font-sans text-stone-100 flex flex-col">
        {/* Simple Cook Header */}
        <header className="bg-stone-950 border-b border-stone-800 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-emerald-500">
            <div className="w-9 h-9 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Kitchen Display</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-stone-200">{user.displayName || user.email}</p>
              <p className="text-xs text-stone-500">Cook Role</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-red-400 hover:bg-stone-800 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>
        
        {/* Cook Main Content */}
        <main className="flex-1 overflow-hidden p-2 sm:p-4">
          {children}
        </main>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  const firstName = user.displayName?.split(" ")[0] || "Admin";

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row font-sans print:bg-white print:block">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shrink-0 print:hidden sticky top-0 z-50 glass">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-stone-600" /> : <Menu className="w-5 h-5 text-stone-600" />}
          </button>
          <div className="flex items-center gap-2 text-emerald-800">
            <UtensilsCrossed className="w-5 h-5" />
            <span className="font-bold text-lg tracking-tight">DineQR</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {firstName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-[260px] bg-white border-r border-stone-200 flex flex-col shrink-0 overflow-y-auto print:hidden",
        "fixed md:sticky top-0 h-screen z-50",
        "transition-transform duration-300 ease-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand Header */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200/50">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-lg text-stone-900 tracking-tight block leading-tight">DineQR</span>
              <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Admin Panel</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold px-3 mb-2 mt-2">Navigation</p>
          {links.map((link, index) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 group relative",
                  "animate-slide-in-left",
                  isActive
                    ? "bg-emerald-50 text-emerald-800 shadow-sm"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-600 rounded-r-full" />
                )}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isActive ? "bg-emerald-100" : "bg-stone-100 group-hover:bg-stone-200"
                )}>
                  <link.icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-stone-400 group-hover:text-stone-600")} />
                </div>
                <span className="text-sm">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="mt-auto p-3 border-t border-stone-100">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-stone-50/80 mb-2">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-800 truncate">{user.displayName || user.email}</p>
              <p className="text-[10px] text-stone-400 truncate uppercase tracking-wider font-medium">{role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen md:min-h-0 overflow-hidden">
        {/* Top Bar */}
        <header className="hidden md:flex items-center justify-between bg-white/80 glass border-b border-stone-200/60 px-8 py-4 shrink-0 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {greeting}, <span className="text-emerald-700">{firstName}</span> 👋
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <p className="text-xs text-stone-400 font-medium">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-stone-800">{user.displayName || user.email}</p>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{role}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-white font-bold shadow-md shadow-emerald-200/50">
                {firstName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
