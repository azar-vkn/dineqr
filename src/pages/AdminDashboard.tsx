import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, getDoc, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2, CheckCircle2, Clock, ChefHat, Utensils, Database, Filter, BellRing, Wallet } from "lucide-react";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  paymentStatus: string;
  paymentMethod?: string;
  customerName?: string;
  createdAt: any;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>("All");
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const previousOrderCount = useRef<number>(0);

  // Fetch user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.email === "asirselvin446@gmail.com") {
          setRole("admin");
          return;
        }
        
        try {
          if (!currentUser.email) return;
          const userDoc = await getDoc(doc(db, "users", currentUser.email));
          if (userDoc.exists()) {
            setRole(userDoc.data().role as "admin" | "staff");
          } else {
            const q = query(collection(db, "users"), where("email", "==", currentUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setRole(querySnapshot.docs[0].data().role as "admin" | "staff");
            }
          }
        } catch (error) {
          console.error("Error fetching role:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Create an audio element for the notification sound
  const playNotificationSound = () => {
    try {
      // A simple short beep using Web Audio API
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      
      // Check if there's a new pending order
      // Only notify for orders visible to the current user
      const visibleOrders = fetchedOrders.filter(o => {
        if (role === 'staff' && o.paymentStatus === 'pending_collection') return false;
        return true;
      });

      const currentPendingCount = visibleOrders.filter(o => o.status === "pending").length;
      if (currentPendingCount > previousOrderCount.current && !loading) {
        playNotificationSound();
        toast("🔔 New Order Received!", {
          description: "A new order has been placed.",
          duration: 5000,
        });
      }
      previousOrderCount.current = currentPendingCount;
      
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    return () => unsubscribe();
  }, [loading, role]);

  const updateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus
      });
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update status: " + (error.message || "Unknown error"));
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const markAsPaid = async (orderId: string) => {
    console.log(`Attempting to mark order ${orderId} as paid...`);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        paymentStatus: "paid"
      });
      console.log(`Order ${orderId} successfully marked as paid.`);
      toast.success("Payment marked as collected. Order is now visible to staff.");
      setConfirmingOrderId(null);
    } catch (error: any) {
      console.error("Error marking as paid:", error);
      toast.error("Failed to mark as collected: " + (error.message || "Unknown error"));
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-800 border-amber-200 animate-pulse";
      case "preparing": return "bg-blue-100 text-blue-800 border-blue-200";
      case "ready": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "served": return "bg-stone-100 text-stone-600 border-stone-200";
      case "cancelled": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-stone-100 text-stone-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <BellRing className="w-4 h-4" />;
      case "preparing": return <ChefHat className="w-4 h-4" />;
      case "ready": return <CheckCircle2 className="w-4 h-4" />;
      case "served": return <Utensils className="w-4 h-4" />;
      case "cancelled": return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">✕</span>;
      default: return null;
    }
  };

  const seedMenu = async () => {
    const sampleMenu = [
      { name: "Paneer Tikka", description: "Grilled cottage cheese cubes marinated in spices.", price: 250, category: "Starters", available: true, image: "https://picsum.photos/seed/paneer/400/400" },
      { name: "Crispy Corn", description: "Fried sweet corn tossed in spicy seasoning.", price: 180, category: "Starters", available: true, image: "https://picsum.photos/seed/corn/400/400" },
      { name: "Butter Chicken", description: "Classic creamy tomato curry with tender chicken.", price: 350, category: "Main Course", available: true, image: "https://picsum.photos/seed/chicken/400/400" },
      { name: "Dal Makhani", description: "Slow-cooked black lentils with butter and cream.", price: 220, category: "Main Course", available: true, image: "https://picsum.photos/seed/dal/400/400" },
      { name: "Garlic Naan", description: "Soft flatbread topped with minced garlic and butter.", price: 60, category: "Main Course", available: true, image: "https://picsum.photos/seed/naan/400/400" },
      { name: "Fresh Lime Soda", description: "Refreshing sweet and salty lime drink.", price: 90, category: "Drinks", available: true, image: "https://picsum.photos/seed/lime/400/400" },
      { name: "Cold Coffee", description: "Thick and creamy blended iced coffee.", price: 150, category: "Drinks", available: true, image: "https://picsum.photos/seed/coffee/400/400" },
      { name: "Gulab Jamun", description: "Deep-fried milk dumplings in sugar syrup.", price: 120, category: "Desserts", available: true, image: "https://picsum.photos/seed/jamun/400/400" },
      { name: "Chocolate Brownie", description: "Warm fudgy brownie with vanilla ice cream.", price: 180, category: "Desserts", available: true, image: "https://picsum.photos/seed/brownie/400/400" }
    ];

    try {
      for (const item of sampleMenu) {
        await addDoc(collection(db, "menu"), item);
      }
      toast.success("Menu seeded successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "menu");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-stone-500 font-medium">Loading Live Orders...</p>
      </div>
    );
  }

  // Filter orders based on role and status
  const activeOrders = orders.filter(o => {
    // Hide served/cancelled orders
    if (o.status === "served" || o.status === "cancelled") return false;
    
    // Hide uncollected cash orders from staff
    if (role === 'staff' && o.paymentStatus === 'pending_collection') return false;
    
    return true;
  });
  
  // Get unique table numbers for filtering
  const tableNumbers = Array.from(new Set(activeOrders.map(o => String(o.tableNumber)))).sort((a: string, b: string) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const filteredOrders = selectedTable === "All" 
    ? activeOrders 
    : activeOrders.filter(o => o.tableNumber === selectedTable);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Live Orders</h1>
            <p className="text-stone-500 mt-1">Manage incoming orders from tables in real-time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-sm">
              <Filter className="w-4 h-4 text-stone-400" />
              <select 
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="bg-transparent text-sm font-medium text-stone-700 focus:outline-none cursor-pointer"
              >
                <option value="All">All Tables</option>
                {tableNumbers.map(table => (
                  <option key={table} value={table}>Table {table}</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={seedMenu}
              className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-sm hidden md:flex"
              title="Add sample items to the menu"
            >
              <Database className="w-4 h-4" />
              Seed Menu
            </button>
            <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full font-bold shadow-sm">
              {activeOrders.length} Active
            </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map(order => (
            <div key={order.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all duration-300 ${order.status === 'pending' ? 'border-amber-300 shadow-amber-100/50 shadow-lg ring-2 ring-amber-100' : 'border-stone-200'}`}>
              <div className={`p-5 border-b flex justify-between items-start ${order.status === 'pending' ? 'bg-amber-50/30 border-amber-100' : 'bg-stone-50/50 border-stone-100'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-500 uppercase tracking-wider">Table</span>
                    <span className="text-3xl font-black text-emerald-900">{order.tableNumber}</span>
                  </div>
                  {order.customerName && order.customerName !== "Guest" && (
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mt-0.5">{order.customerName}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1">
                    {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)}
                  <span className="capitalize">{order.status}</span>
                </div>
              </div>
              
              <div className="p-5 flex-1">
                <ul className="space-y-3">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between text-sm">
                      <span className="font-medium text-stone-800">
                        <span className="text-stone-400 mr-2">{item.quantity}x</span>
                        {item.name}
                      </span>
                      <span className="text-stone-500">₹{item.price * item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="p-5 bg-stone-50 border-t border-stone-100 space-y-4">
                <div className="flex justify-between items-center font-bold text-stone-900">
                  <span>Total ({order.paymentStatus === "paid" ? "Paid" : "Cash"})</span>
                  <span className="text-emerald-700">₹{order.total}</span>
                </div>
                
                {order.paymentStatus === "pending_collection" && role === "admin" && (
                  <div className="bg-red-50 text-red-800 text-sm font-bold px-3 py-4 rounded-xl text-center border border-red-100 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center justify-center gap-2">
                      <Wallet className="w-5 h-5" />
                      <span>Offline Payment : Amount need to be collected</span>
                    </div>
                    
                    {confirmingOrderId === order.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-red-600">Confirm cash collection?</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => markAsPaid(order.id)}
                            className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-emerald-700 transition-all font-bold shadow-sm active:scale-95"
                          >
                            Yes, Collected
                          </button>
                          <button 
                            onClick={() => setConfirmingOrderId(null)}
                            className="flex-1 bg-stone-400 text-white py-2 px-4 rounded-lg text-sm hover:bg-stone-500 transition-all font-bold shadow-sm active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmingOrderId(order.id)}
                        className="bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-all font-bold shadow-sm active:scale-95"
                      >
                        Collected
                      </button>
                    )}
                  </div>
                )}
                
                {order.paymentStatus !== "pending_collection" && (
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      onClick={() => updateOrderStatus(order.id, "preparing")}
                      disabled={order.status === "preparing"}
                      className="py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      Prepare
                    </button>
                    <button 
                      onClick={() => updateOrderStatus(order.id, "ready")}
                      disabled={order.status === "ready"}
                      className="py-2 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      Ready
                    </button>
                    <button 
                      onClick={() => updateOrderStatus(order.id, "served")}
                      className="py-2 text-xs font-bold rounded-lg bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors disabled:opacity-50"
                    >
                      Served
                    </button>
                    <button 
                      onClick={() => {
                        updateOrderStatus(order.id, "cancelled");
                        toast.success("Order cancelled");
                      }}
                      className="py-2 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {filteredOrders.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-300">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-700">No active orders</h3>
              <p className="text-stone-500 mt-2">
                {selectedTable === "All" ? "Waiting for customers to place orders..." : `No active orders for Table ${selectedTable}.`}
              </p>
            </div>
          )}
        </div>
    </div>
  );
}
