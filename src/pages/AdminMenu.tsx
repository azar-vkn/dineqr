import { useState, useEffect, FormEvent } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { tenantCollection, tenantDoc } from "../lib/tenant";
import { useTenant } from "../hooks/useTenant";
import { Loader2, Plus, Trash2, Image as ImageIcon, Check, X, Flame } from "lucide-react";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  isVeg?: boolean;
  spiceLevel?: number;
}

export default function AdminMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { restaurantId, loading: tenantLoading } = useTenant();
  const [isAdding, setIsAdding] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Starters");
  const [image, setImage] = useState("");
  const [available, setAvailable] = useState(true);
  const [isVeg, setIsVeg] = useState(true);
  const [spiceLevel, setSpiceLevel] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (tenantLoading) return;
    const menuRef = restaurantId ? tenantCollection(db, restaurantId, "menu") : collection(db, "menu");
    const q = query(menuRef, orderBy("category"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: MenuItem[] = [];
      snapshot.forEach((doc) => {
        fetchedItems.push({ id: doc.id, ...doc.data() } as MenuItem);
      });
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "menu");
    });

    return () => unsubscribe();
  }, [restaurantId, tenantLoading]);

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !price || !category) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(restaurantId ? tenantCollection(db, restaurantId, "menu") : collection(db, "menu"), {
        name,
        description,
        price: Number(price),
        category,
        image,
        available,
        isVeg,
        spiceLevel: Number(spiceLevel)
      });
      toast.success("Menu item added successfully!");
      
      // Reset form
      setName("");
      setDescription("");
      setPrice("");
      setCategory("Starters");
      setImage("");
      setAvailable(true);
      setIsVeg(true);
      setSpiceLevel(0);
      setIsAdding(false);
      setSubmitting(false);
    } catch (error) {
      setSubmitting(false);
      handleFirestoreError(error, OperationType.CREATE, "menu");
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(restaurantId ? tenantDoc(db, restaurantId, "menu", itemToDelete) : doc(db, "menu", itemToDelete));
      toast.success("Item deleted.");
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `menu/${itemToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(restaurantId ? tenantDoc(db, restaurantId, "menu", id) : doc(db, "menu", id), {
        available: !currentStatus
      });
      toast.success(`Item marked as ${!currentStatus ? 'available' : 'unavailable'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `menu/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-stone-500 font-medium">Loading menu items...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Menu Management</h1>
          <p className="text-stone-500 mt-1">Add, edit, or remove items from your restaurant menu.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center justify-center gap-2 bg-emerald-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-900 transition-colors shadow-sm"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? "Cancel" : "Add New Item"}
        </button>
      </header>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-bold text-stone-800 mb-6">Add New Menu Item</h2>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Item Name *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Margherita Pizza"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Price (₹) *</label>
                <input 
                  type="number" 
                  value={price} 
                  onChange={e => setPrice(e.target.value)} 
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 299"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Category *</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Starters">Starters</option>
                  <option value="Main Course">Main Course</option>
                  <option value="Drinks">Drinks</option>
                  <option value="Desserts">Desserts</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Image URL</label>
                <input 
                  type="url" 
                  value={image} 
                  onChange={e => setImage(e.target.value)} 
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-stone-700">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={2}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Brief description of the dish..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Dietary Preference</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={isVeg === true} 
                      onChange={() => setIsVeg(true)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-stone-700">Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={isVeg === false} 
                      onChange={() => setIsVeg(false)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-stone-700">Non-Vegetarian</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Spice Level (0-3)</label>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="3" 
                    value={spiceLevel} 
                    onChange={e => setSpiceLevel(Number(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <div className="flex w-12 justify-center">
                    {spiceLevel === 0 ? <span className="text-stone-400 text-sm">None</span> : 
                     Array.from({ length: spiceLevel }).map((_, i) => <Flame key={i} className="w-4 h-4 text-red-500 fill-red-500" />)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:col-span-2 pt-2">
                <input 
                  type="checkbox" 
                  id="available" 
                  checked={available} 
                  onChange={e => setAvailable(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                />
                <label htmlFor="available" className="text-sm font-medium text-stone-700">Item is currently available</label>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={submitting}
                className="flex items-center gap-2 bg-emerald-800 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-emerald-900 transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Item
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Item</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Price</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    No items found. Add your first menu item above!
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-stone-100 shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 text-stone-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-stone-800">{item.name}</p>
                          <p className="text-xs text-stone-500 truncate max-w-[200px]">{item.description || "No description"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-stone-600 text-sm">{item.category}</td>
                    <td className="p-4 font-medium text-emerald-700">₹{item.price}</td>
                    <td className="p-4">
                      <button 
                        onClick={() => toggleAvailability(item.id, item.available)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                          item.available 
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" 
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }`}
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-stone-800">Delete Item?</h3>
              <p className="text-stone-500 text-sm">
                Are you sure you want to delete this menu item? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-stone-100 text-stone-700 font-medium rounded-xl hover:bg-stone-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
