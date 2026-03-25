import { ReactNode } from "react";
import { ShoppingBag, UtensilsCrossed, AlertCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCartStore } from "../store";

export default function Layout({ children }: { children: ReactNode }) {
  const { items, tableNumber } = useCartStore();
  const location = useLocation();
  
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const isCartPage = location.pathname === "/cart" || location.pathname === "/checkout";

  // If there's no table number and we are not on the menu page (which sets it), show an error
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
              <div className="text-sm font-black bg-emerald-100 px-4 py-1.5 rounded-full text-emerald-800 border border-emerald-200 shadow-sm">
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
      
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
