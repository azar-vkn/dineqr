import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCartStore } from "../store";
import MenuItemCard from "../components/MenuItemCard";
import { Search, ArrowRight } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import { MenuSkeleton } from "../components/Skeletons";
import type { MenuItem } from "../types";

export default function MenuPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const setTableNumber = useCartStore((state) => state.setTableNumber);
  const { items, getTotal } = useCartStore();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVeg, setFilterVeg] = useState<"all" | "veg" | "nonveg">("all");
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({}); 

  useEffect(() => {
    if (tableId) {
      setTableNumber(tableId);
    }
  }, [tableId, setTableNumber]);

  useEffect(() => {
    const q = query(collection(db, "menu"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MenuItem);
      });
      setMenuItems(items);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "menu");
    });

    return () => unsubscribe();
  }, []);

  // Fetch menu item ratings
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "menuRatings"), (snapshot) => {
      const ratingsMap: Record<string, { avg: number; count: number }> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.ratingCount > 0) {
          ratingsMap[doc.id] = {
            avg: data.totalRating / data.ratingCount,
            count: data.ratingCount,
          };
        }
      });
      setRatings(ratingsMap);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <MenuSkeleton count={4} />
        <MenuSkeleton count={2} />
      </div>
    );
  }

  const categories = ["All", ...Array.from(new Set(menuItems.map(item => item.category)))];
  
  let filteredItems = activeCategory === "All" 
    ? menuItems 
    : menuItems.filter(item => item.category === activeCategory);

  if (searchQuery.trim()) {
    const lowerQuery = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) || 
      (item.description && item.description.toLowerCase().includes(lowerQuery))
    );
  }

  if (filterVeg === "veg") {
    filteredItems = filteredItems.filter(item => item.isVeg === true);
  } else if (filterVeg === "nonveg") {
    filteredItems = filteredItems.filter(item => item.isVeg === false);
  }

  const groupedItems: Record<string, MenuItem[]> = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="space-y-6 pb-24">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search dishes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
        <div className="flex bg-white rounded-xl border border-stone-200 p-1 shrink-0 h-[50px]">
          <button 
            onClick={() => setFilterVeg("all")}
            className={`px-4 rounded-lg text-sm font-medium transition-colors ${filterVeg === "all" ? "bg-stone-100 text-stone-800" : "text-stone-500 hover:text-stone-800"}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilterVeg("veg")}
            className={`px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${filterVeg === "veg" ? "bg-green-50 text-green-700" : "text-stone-500 hover:text-green-700"}`}
          >
            <div className="w-3 h-3 border border-green-600 flex items-center justify-center rounded-sm"><div className="w-1.5 h-1.5 bg-green-600 rounded-full" /></div>
            Veg
          </button>
          <button 
            onClick={() => setFilterVeg("nonveg")}
            className={`px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${filterVeg === "nonveg" ? "bg-red-50 text-red-700" : "text-stone-500 hover:text-red-700"}`}
          >
            <div className="w-3 h-3 border border-red-600 flex items-center justify-center rounded-sm"><div className="w-1.5 h-1.5 bg-red-600 rounded-full" /></div>
            Non-veg
          </button>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex overflow-x-auto pb-4 gap-2 scrollbar-hide -mx-4 px-4 sticky top-16 bg-stone-50/90 backdrop-blur z-40 py-2">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === category 
                ? "bg-emerald-800 text-white shadow-md" 
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      {Object.entries(groupedItems).length > 0 ? (
        Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">{category}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map(item => (
                <MenuItemCard 
                  key={item.id} 
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  image={item.image}
                  available={item.available}
                  isVeg={item.isVeg}
                  spiceLevel={item.spiceLevel}
                  avgRating={ratings[item.id]?.avg}
                  ratingCount={ratings[item.id]?.count}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-100">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-bold text-stone-800">No items found</h3>
          <p className="text-stone-500 mt-1">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Floating Cart Summary */}
      {items.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 duration-300">
          <button
            onClick={() => navigate("/cart")}
            className="w-full bg-emerald-800 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between group hover:bg-emerald-900 transition-all active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-700 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg">
                {itemCount}
              </div>
              <div className="text-left">
                <p className="text-xs text-emerald-300 font-medium uppercase tracking-wider">Items in Cart</p>
                <p className="font-bold text-lg">₹{getTotal()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 font-bold text-lg">
              Buy Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
