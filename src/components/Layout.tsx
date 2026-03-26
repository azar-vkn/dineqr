import { ReactNode, useState } from "react";
import { ShoppingBag, UtensilsCrossed, AlertCircle, ClipboardList, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCartStore } from "../store";

export default function Layout({ children }: { children: ReactNode }) {
  const { items, tableNumber, customerName, setCustomerName, lastOrderId, setLastOrderId } = useCartStore();
  const location = useLocation();
  const [nameInput, setNameInput] = useState("");
  
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const isCartPage = location.pathname === "/cart" || location.pathname === "/checkout";
  const isTrackingPage = location.pathname.startsWith("/order/");
  const showTrackBanner = lastOrderId && !isTrackingPage;

  // If there's no table number and we are not on the menu page or order tracking page, show an error
  if (!tableNumber && !location.pathname.startsWith("/table/") && !location.pathname.startsWith("/order/")) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Table Number Missing</h1>
        <p className="text-stone-500 max-w-md">
          We couldn't identify your table. Please scan the QR code on your table to view the menu and place an order.
        </p>
      </div>
    );
  }

  // If we have a table number or are entering one, but no customer name
  const isCustomerRoute = location.pathname.startsWith("/table/") || location.pathname.startsWith("/order/") || location.pathname === "/cart" || location.pathname === "/checkout";
  if (!customerName && isCustomerRoute) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 max-w-sm w-full space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-2">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Welcome to DineQR</h1>
            <p className="text-stone-500">Please enter your name to view the menu and place your order.</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (nameInput.trim()) {
              setCustomerName(nameInput.trim());
            }
          }} className="space-y-4 pt-2">
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-stone-800"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full py-3 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors disabled:opacity-50"
            >
              Continue to Menu
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-24">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={tableNumber ? `/table/${tableNumber}` : "/"} className="flex items-center gap-2 text-emerald-800">
            <UtensilsCrossed className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">DineQR</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {tableNumber && (
              <div className="text-sm font-black bg-emerald-100 px-4 py-1.5 rounded-full text-emerald-800 border border-emerald-200 shadow-sm whitespace-nowrap">
                Table {tableNumber}
              </div>
            )}
            
            {!isCartPage && (
              <Link to="/cart" className="relative p-2 text-stone-700 hover:text-emerald-700 transition-colors">
                <ShoppingBag className="w-6 h-6" />
                {itemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Floating Track Order Banner */}
      {showTrackBanner && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300">
            <Link
              to={`/order/${lastOrderId}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-emerald-900 text-sm">Track Your Order</p>
                <p className="text-xs text-emerald-600 truncate">Tap to view your live order status</p>
              </div>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <button
                onClick={() => setLastOrderId(null)}
                className="p-1.5 text-emerald-400 hover:text-emerald-700 transition-colors rounded-lg hover:bg-emerald-100"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
