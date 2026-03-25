import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MenuSquare, QrCode, UtensilsCrossed, LogOut, Loader2, Users, TrendingUp, ClipboardList } from "lucide-react";
import { cn } from "../lib/utils";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      
      if (currentUser) {
        // Check if bootstrap admin
        if (currentUser.email === "asirselvin446@gmail.com") {
          setRole("admin");
          setLoading(false);
          return;
        }
        
        // Fetch role from Firestore
        try {
          if (!currentUser.email) {
            setRole(null);
            setLoading(false);
            return;
          }
          
          // Try to get by email as document ID first (new format)
          const userDoc = await getDoc(doc(db, "users", currentUser.email));
          if (userDoc.exists()) {
            setRole(userDoc.data().role as "admin" | "staff");
          } else {
            // Fallback: query by email field (old format with random IDs)
            const q = query(collection(db, "users"), where("email", "==", currentUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setRole(querySnapshot.docs[0].data().role as "admin" | "staff");
            } else {
              setRole(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Logged in successfully");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to log in");
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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 max-w-md w-full text-center space-y-6">
          <div className="flex items-center justify-center gap-2 text-emerald-800 mb-2">
            <UtensilsCrossed className="w-8 h-8" />
            <span className="font-bold text-2xl tracking-tight">DineQR Admin</span>
          </div>
          <p className="text-stone-500">Please sign in to access the admin dashboard.</p>
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 max-w-md w-full text-center space-y-6">
          <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
            <UtensilsCrossed className="w-8 h-8" />
            <span className="font-bold text-2xl tracking-tight">Access Denied</span>
          </div>
          <p className="text-stone-500">You do not have permission to access the admin dashboard. Please sign in with an authorized staff or administrator account.</p>
          <p className="text-sm font-medium text-stone-800 bg-stone-100 py-2 px-4 rounded-lg">
            Current user: {user.email}
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-stone-800 text-white font-medium rounded-xl hover:bg-stone-900 transition-colors"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  const links = [
    { name: "Live Orders", path: "/admin", icon: LayoutDashboard, roles: ["admin", "staff"] },
    { name: "Revenue & Stats", path: "/admin/stats", icon: TrendingUp, roles: ["admin"] },
    { name: "Menu Management", path: "/admin/menu", icon: MenuSquare, roles: ["admin"] },
    { name: "QR Codes", path: "/admin/qr", icon: QrCode, roles: ["admin", "staff"] },
    { name: "Staff Management", path: "/admin/staff", icon: Users, roles: ["admin"] },
    { name: "Order History", path: "/admin/history", icon: ClipboardList, roles: ["admin", "staff"] },
  ].filter(link => link.roles.includes(role));

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row font-sans print:bg-white print:block">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-stone-200 p-4 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen overflow-y-auto print:hidden">
        <div className="flex items-center gap-2 text-emerald-800 mb-8 px-4 pt-4">
          <UtensilsCrossed className="w-6 h-6" />
          <span className="font-bold text-xl tracking-tight">DineQR Admin</span>
        </div>
        
        <nav className="flex flex-col gap-1 flex-1">
          {links.map(link => {
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path} 
                to={link.path} 
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors", 
                  isActive 
                    ? "bg-emerald-50 text-emerald-800" 
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <link.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-stone-400")} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-stone-100">
          <div className="px-4 py-3 mb-2">
            <p className="text-sm font-medium text-stone-800 truncate">{user.displayName || user.email}</p>
            <p className="text-xs text-stone-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto print:overflow-visible print:p-0">
        {children}
      </main>
    </div>
  );
}
