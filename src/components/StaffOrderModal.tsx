import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp, query, where, getDocs, doc, orderBy, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { tenantCollection, tenantDoc } from "../lib/tenant";
import { useTenant } from "../hooks/useTenant";
import { toast } from "sonner";
import { X, Plus, Minus, ShoppingBag, Loader2, UtensilsCrossed, Package, ChefHat } from "lucide-react";
import type { MenuItem } from "../types";
import { GST_MULTIPLIER, GST_PERCENT } from "../lib/constants";

interface StaffOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
}

function generateTrackingToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface CartEntry {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function StaffOrderModal({ isOpen, onClose, staffId, staffName }: StaffOrderModalProps) {
  const { restaurantId } = useTenant();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"dine" | "parcel">("dine");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Fetch available menu items
  useEffect(() => {
    if (!isOpen) return;
    const q = query(restaurantId ? tenantCollection(db, restaurantId, "menu") : collection(db, "menu"), where("available", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MenuItem);
      });
      setMenuItems(items);
      setLoadingMenu(false);
    });
    return () => unsubscribe();
  }, [isOpen, restaurantId]);

  const categories = ["All", ...Array.from(new Set(menuItems.map((i) => i.category)))];
  const filteredItems = activeCategory === "All" ? menuItems : menuItems.filter((i) => i.category === activeCategory);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === itemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const getCartItem = (itemId: string) => cart.find((c) => c.id === itemId);

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const total = Math.round(subtotal * GST_MULTIPLIER);

  const handleSubmit = async () => {
    if (!tableNumber.trim()) {
      toast.error("Please enter a table number");
      return;
    }
    if (cart.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setIsSubmitting(true);
    try {
      const newItems = cart.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      }));

      const activeStatuses = ["pending", "preparing", "ready"];

      // Create-new-order helper (used when no active order exists on the table,
      // or the existing one vanished between lookup and merge).
      const createNewOrder = async () => {
        const trackingToken = generateTrackingToken();
        await addDoc(restaurantId ? tenantCollection(db, restaurantId, "orders") : collection(db, "orders"), {
          tableNumber: tableNumber.trim(),
          customerName: customerName.trim() || "Walk-in",
          items: newItems,
          total,
          status: "pending",
          paymentStatus: "pending_collection",
          paymentMethod: "cash",
          orderType,
          orderSource: "staff",
          staffId,
          staffName,
          trackingToken,
          createdAt: serverTimestamp(),
        });
        toast.success("New order placed successfully!");
      };

      // Find an existing active staff order for this table.
      const ordersQuery = query(
        restaurantId ? tenantCollection(db, restaurantId, "orders") : collection(db, "orders"),
        where("tableNumber", "==", tableNumber.trim()),
        where("orderSource", "==", "staff"),
        where("status", "in", activeStatuses)
      );
      const existingSnap = await getDocs(ordersQuery);

      if (existingSnap.empty) {
        await createNewOrder();
      } else {
        // ─── Merge into existing order, ATOMICALLY ───
        // Two staff submitting for the same table used to read-then-write and
        // clobber each other (lost update). Re-read inside a transaction so
        // concurrent merges retry against fresh data instead of overwriting.
        const existingRef = restaurantId ? tenantDoc(db, restaurantId, "orders", existingSnap.docs[0].id) : doc(db, "orders", existingSnap.docs[0].id);
        let merged = false;
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(existingRef);
          const data = snap.exists() ? snap.data() : null;
          if (!data || !activeStatuses.includes(data.status)) {
            merged = false; // order was served/removed meanwhile → create new below
            return;
          }
          const existingItems: CartEntry[] = data.items || [];
          const mergedMap = new Map<string, CartEntry>();
          for (const item of existingItems) mergedMap.set(item.id, { ...item });
          for (const item of newItems) {
            const ex = mergedMap.get(item.id);
            if (ex) ex.quantity += item.quantity;
            else mergedMap.set(item.id, { ...item });
          }
          const mergedItems = Array.from(mergedMap.values());
          const newSubtotal = mergedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
          const newTotal = Math.round(newSubtotal * GST_MULTIPLIER);
          tx.update(existingRef, {
            items: mergedItems,
            total: newTotal,
            status: "pending", // resurface to kitchen with the added items
          });
          merged = true;
        });

        if (merged) {
          toast.success(`Items added to existing order for Table ${tableNumber.trim()}`);
        } else {
          await createNewOrder();
        }
      }

      // Reset form
      setTableNumber("");
      setCustomerName("");
      setOrderType("dine");
      setCart([]);
      onClose();
    } catch (error: any) {
      console.error("Staff order error:", error);
      toast.error("Failed to place order: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-stone-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Place Order for Customer</h2>
              <p className="text-xs text-stone-500">
                Ordering as <span className="font-bold text-indigo-700">{staffName} ({staffId})</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Order Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Table Number *
              </label>
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 5"
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in"
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Order Type */}
          <div className="flex gap-2 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setOrderType("dine")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                orderType === "dine" ? "bg-white shadow-sm text-emerald-800" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" /> Dine In
            </button>
            <button
              onClick={() => setOrderType("parcel")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                orderType === "parcel" ? "bg-white shadow-sm text-amber-800" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <Package className="w-4 h-4" /> Parcel
            </button>
          </div>

          {/* Menu Items */}
          <div>
            <h3 className="text-sm font-bold text-stone-700 mb-3">Select Items</h3>

            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loadingMenu ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                  const cartItem = getCartItem(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        cartItem ? "border-indigo-200 bg-indigo-50/30" : "border-stone-100 bg-white hover:border-stone-200"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-emerald-700">₹{item.price}</span>
                          <span className="text-[10px] text-stone-400 uppercase">{item.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3">
                        {cartItem ? (
                          <>
                            <button
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center hover:bg-indigo-200 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-stone-800">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center hover:bg-indigo-200 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredItems.length === 0 && (
                  <p className="text-center text-sm text-stone-400 py-6">No items in this category.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer — Order Summary + Submit */}
        <div className="shrink-0 border-t border-stone-200 bg-stone-50 p-5 space-y-3">
          {cart.length > 0 && (
            <div className="space-y-1.5">
              {cart.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-stone-600">
                    <span className="text-stone-400 mr-1">{c.quantity}×</span>
                    {c.name}
                  </span>
                  <span className="text-stone-700 font-medium">₹{c.price * c.quantity}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-stone-400 pt-1 border-t border-dashed border-stone-200">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-400">
                <span>GST ({GST_PERCENT}%)</span>
                <span>₹{total - subtotal}</span>
              </div>
              <div className="flex justify-between font-bold text-stone-900 pt-1">
                <span>Total</span>
                <span className="text-emerald-700">₹{total}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || cart.length === 0 || !tableNumber.trim()}
            className="w-full py-3 bg-indigo-700 text-white font-bold rounded-xl hover:bg-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Placing Order...
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                Place Order{cart.length > 0 ? ` — ₹${total}` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
