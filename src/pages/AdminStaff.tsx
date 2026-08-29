import { useState, useEffect, FormEvent } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import { Trash2, UserPlus, Shield, User, Phone, Mail, Hash, ToggleLeft, ToggleRight, BadgeCheck, UserX, UtensilsCrossed } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { BOOTSTRAP_ADMIN_EMAIL } from "../lib/constants";
import type { StaffStatus } from "../types";

interface StaffUser {
  id: string;
  staffId: string;
  displayName: string;
  phone: string;
  email: string;
  role: "admin" | "staff" | "cook";
  status: StaffStatus;
  createdAt: any;
}

export default function AdminStaff() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "staff" | "cook">("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        staffId: doc.data().staffId || "",
        displayName: doc.data().displayName || "",
        phone: doc.data().phone || "",
        email: doc.data().email || "",
        role: (doc.data().role as "admin" | "staff" | "cook") || "staff",
        status: doc.data().status || "active",
        createdAt: doc.data().createdAt,
      })) as StaffUser[];

      // Filter out bootstrap admin from the list
      const filtered = usersData.filter(u => u.email !== BOOTSTRAP_ADMIN_EMAIL);
      setUsers(filtered);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "users");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Collision-safe random id. The old count+1 scheme was racy (two concurrent
  // adds got the same id) and reused ids after a deletion; it also read the
  // entire users collection on every add. A random code avoids all three.
  const generateStaffId = (): string => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    let code = "";
    for (const b of bytes) code += alphabet[b % alphabet.length];
    return `STF-${code}`;
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim() || !newPhone.trim()) return;

    setIsSubmitting(true);
    try {
      const staffId = generateStaffId();
      
      await setDoc(doc(db, "users", newEmail.toLowerCase().trim()), {
        staffId,
        displayName: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.toLowerCase().trim(),
        role: newRole,
        status: "active" as StaffStatus,
        createdAt: serverTimestamp(),
      });

      setNewEmail("");
      setNewName("");
      setNewPhone("");
      setNewRole("staff");
      toast.success("Staff member added successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "users");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (email === BOOTSTRAP_ADMIN_EMAIL) {
      toast.error("Cannot remove the primary administrator");
      return;
    }

    try {
      await deleteDoc(doc(db, "users", id));
      toast.success("Staff member removed");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "users");
    }
  };

  const handleToggleStatus = async (user: StaffUser) => {
    const newStatus: StaffStatus = user.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "users", user.id), { status: newStatus });
      toast.success(`${user.displayName || user.email} is now ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Staff Management</h1>
        <p className="text-stone-500 mt-1">Manage administrators and staff members who can access the dashboard.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─── Add Staff Form ─── */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 sticky top-8">
            <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Add Staff Member
            </h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ramesh Kumar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="staff@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "staff" | "cook")}
                  className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="staff">Staff (View & Update Orders)</option>
                  <option value="admin">Admin (Full Access)</option>
                  <option value="cook">Cook (Kitchen Display Only)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add Member"}
              </button>
            </form>
          </div>
        </div>

        {/* ─── Staff List ─── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Bootstrap Admin Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-stone-900">{BOOTSTRAP_ADMIN_EMAIL}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">Primary Administrator • Cannot be removed</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <BadgeCheck className="w-3.5 h-3.5" /> Active
              </span>
            </div>
          </div>

          {/* Staff Member Cards */}
          {users.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-200 ${
                user.status === "inactive" ? "border-stone-200 opacity-60" : "border-stone-200"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      user.status === "inactive"
                        ? "bg-stone-100 text-stone-400"
                        : user.role === "admin"
                          ? "bg-emerald-100 text-emerald-700"
                          : user.role === "cook"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                    }`}>
                      {user.status === "inactive" ? (
                        <UserX className="w-6 h-6" />
                      ) : user.role === "admin" ? (
                        <Shield className="w-6 h-6" />
                      ) : user.role === "cook" ? (
                        <UtensilsCrossed className="w-6 h-6" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-stone-900 truncate">
                          {user.displayName || user.email}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-emerald-100 text-emerald-800"
                            : user.role === "cook"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                        }`}>
                          {user.role === "admin" ? <Shield className="w-3 h-3" /> : user.role === "cook" ? <UtensilsCrossed className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {user.role}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Added {user.createdAt?.toDate ? new Date(user.createdAt.toDate()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recently"}
                      </p>
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        user.status === "active"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200 border border-stone-200"
                      }`}
                      title={user.status === "active" ? "Deactivate staff" : "Activate staff"}
                    >
                      {user.status === "active" ? (
                        <><ToggleRight className="w-4 h-4" /> Active</>
                      ) : (
                        <><ToggleLeft className="w-4 h-4" /> Inactive</>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Detail Grid */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-stone-400 mb-0.5">
                      <Hash className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Staff ID</span>
                    </div>
                    <p className="text-sm font-bold text-stone-800 font-mono">
                      {user.staffId || "—"}
                    </p>
                  </div>
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-stone-400 mb-0.5">
                      <Mail className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Email</span>
                    </div>
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-stone-400 mb-0.5">
                      <Phone className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Phone</span>
                    </div>
                    <p className="text-sm font-medium text-stone-800">
                      {user.phone || "—"}
                    </p>
                  </div>
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-stone-400 mb-0.5">
                      <User className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Name</span>
                    </div>
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {user.displayName || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-12 text-center">
              <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-7 h-7 text-stone-400" />
              </div>
              <p className="text-stone-500 font-medium">No additional staff members found.</p>
              <p className="text-stone-400 text-sm mt-1">Add your first staff member using the form.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
