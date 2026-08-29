import { useEffect, useState } from "react";
import { onAuthStateChanged, getIdTokenResult, type User } from "firebase/auth";
import { auth } from "../firebase";
import type { Role } from "../types/tenant";

export interface TenantContext {
  user: User | null;
  /** Restaurant the signed-in staff/admin belongs to (from custom claims). */
  restaurantId: string | null;
  role: Role | null;
  /** Provider super-admin — access across all restaurants. */
  platformAdmin: boolean;
  loading: boolean;
}

/**
 * Resolves the current STAFF/admin tenant context from the signed-in user's
 * custom claims ({ restaurantId, role, platformAdmin }).
 *
 * NOTE: customer-facing pages are unauthenticated — they take the restaurantId
 * from the QR URL (useParams), not from this hook.
 */
export function useTenant(): TenantContext {
  const [state, setState] = useState<TenantContext>({
    user: null,
    restaurantId: null,
    role: null,
    platformAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, restaurantId: null, role: null, platformAdmin: false, loading: false });
        return;
      }
      try {
        const token = await getIdTokenResult(user);
        const claims = token.claims as {
          restaurantId?: string;
          role?: Role;
          platformAdmin?: boolean;
        };
        setState({
          user,
          restaurantId: claims.restaurantId ?? null,
          role: claims.role ?? null,
          platformAdmin: claims.platformAdmin === true,
          loading: false,
        });
      } catch {
        setState({ user, restaurantId: null, role: null, platformAdmin: false, loading: false });
      }
    });
    return () => unsub();
  }, []);

  return state;
}
