import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { BOOTSTRAP_ADMIN_EMAIL } from "../lib/constants";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "staff";
}

/**
 * Auth guard component for admin routes.
 * Checks Firebase Auth + Firestore role before rendering children.
 * Redirects unauthenticated users and blocks unauthorized access.
 */
export default function ProtectedRoute({ children, requiredRole = "staff" }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser || !currentUser.email) {
        setRole(null);
        setLoading(false);
        return;
      }

      // Bootstrap admin check
      if (currentUser.email === BOOTSTRAP_ADMIN_EMAIL) {
        setRole("admin");
        setLoading(false);
        return;
      }

      // Fetch role from Firestore
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.email));
        if (userDoc.exists()) {
          setRole(userDoc.data().role as "admin" | "staff");
        } else {
          // Fallback: query by email field (legacy format)
          const q = query(collection(db, "users"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setRole(querySnapshot.docs[0].data().role as "admin" | "staff");
          } else {
            setRole(null);
          }
        }
      } catch (error) {
        console.error("ProtectedRoute: Error fetching role:", error);
        setRole(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Not logged in → redirect to admin login page
  if (!user) {
    return <Navigate to="/admin" replace />;
  }

  // No role → not authorized
  if (!role) {
    return <Navigate to="/admin" replace />;
  }

  // Check specific role requirement
  if (requiredRole === "admin" && role !== "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
