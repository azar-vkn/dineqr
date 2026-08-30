import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getIdToken, signInWithPopup, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { functions, auth } from "../firebase";
import { useTenant } from "../hooks/useTenant";
import { toast } from "sonner";
import { Loader2, Building2, UserPlus, KeyRound, ShieldCheck } from "lucide-react";
import type { Role } from "../types/tenant";

/**
 * Provider-only console to onboard restaurants (tenants), assign staff, and
 * set each restaurant's Razorpay credentials. Gated to platform admins.
 * Route: /#/platform
 */
export default function PlatformConsole() {
  const { user, platformAdmin, loading } = useTenant();
  const [busy, setBusy] = useState<string | null>(null);

  // Create restaurant
  const [rName, setRName] = useState("");
  const [rGst, setRGst] = useState("5");
  const [createdId, setCreatedId] = useState("");

  // Assign user
  const [aEmail, setAEmail] = useState("");
  const [aRid, setARid] = useState("");
  const [aRole, setARole] = useState<Role>("admin");

  // Razorpay
  const [pRid, setPRid] = useState("");
  const [pKeyId, setPKeyId] = useState("");
  const [pKeySecret, setPKeySecret] = useState("");

  const call = async (name: string, data: unknown, busyKey: string): Promise<any> => {
    setBusy(busyKey);
    try {
      const res = await httpsCallable(functions, name)(data);
      return res.data;
    } finally {
      setBusy(null);
    }
  };

  const refreshClaims = async () => {
    if (auth.currentUser) await getIdToken(auth.currentUser, true);
  };

  // Self-contained sign-in (works on web via popup, and on the desktop build
  // via the Electron loopback OAuth flow).
  const handleSignIn = async () => {
    setBusy("signin");
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.signInWithGoogle) {
        const clientId = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
        if (!clientId) {
          toast.error("Desktop sign-in isn't configured.");
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
    } catch {
      toast.error("Sign-in failed.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <Shell>
        <p className="text-stone-600 mb-4">Sign in with your provider account to manage restaurants.</p>
        <button
          onClick={handleSignIn}
          disabled={busy === "signin"}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white font-semibold rounded-xl hover:bg-emerald-900 disabled:opacity-50"
        >
          {busy === "signin" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Sign in with Google
        </button>
      </Shell>
    );
  }

  if (!platformAdmin) {
    return (
      <Shell>
        <p className="text-stone-600 mb-4">
          You're signed in as <b>{user.email}</b> but don't have platform-admin access yet.
        </p>
        <button
          onClick={async () => {
            try {
              await call("claimPlatformAdmin", {}, "claim");
              await refreshClaims();
              toast.success("Platform admin granted. Reloading…");
              setTimeout(() => window.location.reload(), 800);
            } catch (e: any) {
              toast.error(e?.message || "Not authorized (check PLATFORM_ADMIN_EMAIL).");
            }
          }}
          disabled={busy === "claim"}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white font-semibold rounded-xl hover:bg-stone-900 disabled:opacity-50"
        >
          {busy === "claim" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Bootstrap platform admin
        </button>
        <p className="text-xs text-stone-400 mt-3">
          Only works for the email configured as <code>PLATFORM_ADMIN_EMAIL</code> in functions/.env.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Create restaurant */}
        <Card icon={<Building2 className="w-5 h-5" />} title="Create restaurant">
          <Input label="Name" value={rName} onChange={setRName} placeholder="Spice Garden" />
          <Input label="GST %" value={rGst} onChange={setRGst} type="number" />
          <Action
            busy={busy === "create"}
            onClick={async () => {
              try {
                const d = await call("createRestaurant", { name: rName, gstRate: Number(rGst) }, "create");
                setCreatedId(d.restaurantId);
                setARid(d.restaurantId);
                setPRid(d.restaurantId);
                toast.success(`Created: ${d.restaurantId}`);
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              }
            }}
          >
            Create
          </Action>
          {createdId && (
            <p className="text-xs text-stone-500 mt-2 break-all">
              restaurantId: <b>{createdId}</b> (encode in QR: <code>/#/r/{createdId}/table/1</code>)
            </p>
          )}
        </Card>

        {/* Assign user */}
        <Card icon={<UserPlus className="w-5 h-5" />} title="Assign user">
          <Input label="User email" value={aEmail} onChange={setAEmail} placeholder="owner@restaurant.com" />
          <Input label="restaurantId" value={aRid} onChange={setARid} />
          <label className="text-xs font-semibold text-stone-500 uppercase">Role</label>
          <select
            value={aRole}
            onChange={(e) => setARole(e.target.value as Role)}
            className="w-full border border-stone-200 rounded-lg p-2 text-sm mb-3 bg-white"
          >
            <option value="admin">admin</option>
            <option value="staff">staff</option>
            <option value="cook">cook</option>
          </select>
          <Action
            busy={busy === "assign"}
            onClick={async () => {
              try {
                await call("assignUserToRestaurant", { email: aEmail, restaurantId: aRid, role: aRole }, "assign");
                toast.success("Assigned (user must re-login to apply).");
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              }
            }}
          >
            Assign
          </Action>
        </Card>

        {/* Razorpay */}
        <Card icon={<KeyRound className="w-5 h-5" />} title="Set Razorpay keys">
          <Input label="restaurantId" value={pRid} onChange={setPRid} />
          <Input label="Key ID" value={pKeyId} onChange={setPKeyId} placeholder="rzp_live_…" />
          <Input label="Key Secret" value={pKeySecret} onChange={setPKeySecret} type="password" />
          <Action
            busy={busy === "rzp"}
            onClick={async () => {
              try {
                await call("setRestaurantRazorpay", { restaurantId: pRid, keyId: pKeyId, keySecret: pKeySecret }, "rzp");
                setPKeySecret("");
                toast.success("Razorpay keys saved.");
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              }
            }}
          >
            Save keys
          </Action>
        </Card>
      </div>
    </Shell>
  );
}

// ── small presentational helpers ──
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black text-stone-900 mb-1">DineQR — Platform Console</h1>
        <p className="text-stone-400 text-sm mb-8">Onboard and manage restaurants.</p>
        {children}
      </div>
    </div>
  );
}
function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
      <div className="flex items-center gap-2 text-emerald-700 font-bold mb-4">{icon}{title}</div>
      {children}
    </div>
  );
}
function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-semibold text-stone-500 uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-stone-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
function Action({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-emerald-800 text-white font-semibold rounded-xl hover:bg-emerald-900 disabled:opacity-50"
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
