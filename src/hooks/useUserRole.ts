import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { BOOTSTRAP_ADMIN_EMAIL } from "../lib/constants";
import type { UserRole } from "../types";
import type { User } from "firebase/auth";

interface UseUserRoleReturn {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

/**
 * Resolves the current Firebase user and their DineQR role (admin/staff).
 * Replaces duplicated auth + role-checking logic in AdminLayout and AdminDashboard.
 */
export function useUserRole(): UseUserRoleReturn {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        // Bootstrap admin shortcut
        if (currentUser.email === BOOTSTRAP_ADMIN_EMAIL) {
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

          // Try email as document ID first (new format)
          const userDoc = await getDoc(doc(db, "users", currentUser.email));
          if (userDoc.exists()) {
            setRole(userDoc.data().role as UserRole);
          } else {
            // Fallback: query by email field (legacy random-ID format)
            const q = query(
              collection(db, "users"),
              where("email", "==", currentUser.email)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setRole(querySnapshot.docs[0].data().role as UserRole);
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

  return { user, role, loading };
}
