import { useNavigate } from "react-router-dom";
import { useCartStore } from "../store";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

export default function CartPage() {
  const { items, updateQuantity, removeItem, getTotal, tableNumber } = useCartStore();
  const navigate = useNavigate();

  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">🍽️</span>
        </div>
        <h2 className="text-2xl font-bold text-stone-800">Your cart is empty</h2>
        <p className="text-stone-500 max-w-xs">Looks like you haven't added anything to your order yet.</p>
        <button 
          onClick={() => navigate(tableNumber ? `/table/${tableNumber}` : "/")}
          className="mt-8 px-8 py-3 bg-emerald-800 text-white font-medium rounded-full hover:bg-emerald-900 transition-colors"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Your Order</h1>
        {tableNumber && (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
            Table {tableNumber}
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {items.map((item) => (
            <li key={item.id} className="p-4 flex gap-4 items-center">
              {item.image && (
                <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-stone-100" referrerPolicy="no-referrer" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-stone-800">{item.name}</h3>
                <p className="text-emerald-700 font-medium mt-1">₹{item.price}</p>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                <button 
                  onClick={() => removeItem(item.id)}
                  className="text-stone-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-3 bg-stone-50 rounded-full p-1 border border-stone-200">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center bg-white text-stone-700 rounded-full shadow-sm"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-medium text-stone-800 w-4 text-center text-sm">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-white text-stone-700 rounded-full shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-4">
        <h3 className="font-semibold text-stone-800 text-lg">Bill Details</h3>
        <div className="space-y-2 text-sm text-stone-600">
          <div className="flex justify-between">
            <span>Item Total</span>
            <span>₹{total}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxes & Charges (5%)</span>
            <span>₹{Math.round(total * 0.05)}</span>
          </div>
        </div>
        <div className="pt-4 border-t border-stone-100 flex justify-between items-center font-bold text-lg text-stone-900">
          <span>To Pay</span>
          <span>₹{Math.round(total * 1.05)}</span>
        </div>
      </div>

      <button 
        onClick={() => navigate("/checkout")}
        className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-colors shadow-lg shadow-emerald-900/20"
      >
        <span>Proceed to Pay</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
