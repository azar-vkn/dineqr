import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import { Trash2, UserPlus, Shield, User } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";

interface StaffUser {
  id: string;
  email: string;
  role: "admin" | "staff";
  createdAt: any;
}

export default function AdminStaff() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "staff">("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffUser[];
      
      // Self-healing: remove duplicates and migrate random IDs to email IDs
      const uniqueUsers = new Map<string, StaffUser>();
      const duplicatesToDelete: string[] = [];
      const needsMigration: StaffUser[] = [];

      usersData.forEach(user => {
        if (user.email === "asirselvin446@gmail.com") {
          // Primary admin is hardcoded, delete from DB if it exists to avoid confusion
          duplicatesToDelete.push(user.id);
          return;
        }

        if (!uniqueUsers.has(user.email)) {
          uniqueUsers.set(user.email, user);
          // Check if the ID is not the email (meaning it's a random ID)
          if (user.id !== user.email) {
            needsMigration.push(user);
          }
        } else {
          // It's a duplicate, mark for deletion
          duplicatesToDelete.push(user.id);
        }
      });

      // Perform cleanup in the background
      if (duplicatesToDelete.length > 0 || needsMigration.length > 0) {
        try {
          const { setDoc } = await import("firebase/firestore");
          
          // Migrate users with random IDs to email IDs
          for (const user of needsMigration) {
            await setDoc(doc(db, "users", user.email), {
              email: user.email,
              role: user.role,
              createdAt: user.createdAt || serverTimestamp()
            });
            duplicatesToDelete.push(user.id); // Delete the old random ID doc
          }

          // Delete all marked duplicates and old random ID docs
          for (const id of duplicatesToDelete) {
            await deleteDoc(doc(db, "users", id));
          }
        } catch (error) {
          console.error("Error during user cleanup:", error);
        }
      }
      
      setUsers(Array.from(uniqueUsers.values()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "users");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsSubmitting(true);
    try {
      // Note: We are using addDoc which creates a random ID.
      // In a real app, you might want the document ID to be the user's UID,
      // but since we can't easily get the UID from just an email without an Admin SDK,
      // we'll store them by random ID and update the security rules to check by email.
      // Wait, our security rules check `exists(/databases/$(database)/documents/users/$(request.auth.uid))`
      // This means the document ID MUST be the user's UID.
      // Since we can't create a user with a specific UID from the client side without them logging in first,
      // we need to change the security rules to check by email, or we need the user to log in first.
      
      // Let's use the email as the document ID for simplicity in this RBAC implementation!
      // This is a common pattern for invite-based systems when you don't have the UID yet.
      
      // Actually, let's just use setDoc with the email as the ID.
      await setDoc(doc(db, "users", newEmail.toLowerCase().trim()), {
        email: newEmail.toLowerCase().trim(),
        role: newRole,
        createdAt: serverTimestamp()
      });
      
      setNewEmail("");
      setNewRole("staff");
      toast.success("Staff member added successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "users");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (email === "asirselvin446@gmail.com") {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Staff Management</h1>
        <p className="text-stone-500 mt-1">Manage administrators and staff members who can access the dashboard.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 sticky top-8">
            <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Add Staff Member
            </h2>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email Address</label>
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
                  onChange={(e) => setNewRole(e.target.value as "admin" | "staff")}
                  className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="staff">Staff (View & Update Orders)</option>
                  <option value="admin">Admin (Full Access)</option>
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

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="p-4 font-semibold text-stone-600 text-sm">User</th>
                    <th className="p-4 font-semibold text-stone-600 text-sm">Role</th>
                    <th className="p-4 font-semibold text-stone-600 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {/* Always show the bootstrap admin */}
                  <tr className="hover:bg-stone-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-stone-900">asirselvin446@gmail.com</p>
                          <p className="text-xs text-stone-500">Primary Administrator</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs text-stone-400 italic">Cannot be removed</span>
                    </td>
                  </tr>
                  
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            user.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role === 'admin' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">{user.email}</p>
                            <p className="text-xs text-stone-500">
                              Added {user.createdAt?.toDate ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove user"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-stone-500">
                        No additional staff members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
