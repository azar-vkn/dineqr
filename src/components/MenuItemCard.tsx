import React from "react";
import { Plus, Minus, Flame } from "lucide-react";
import { useCartStore } from "../store";
import { cn } from "../lib/utils";

interface MenuItemProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  available: boolean;
  isVeg?: boolean;
  spiceLevel?: number;
}

const MenuItemCard: React.FC<MenuItemProps> = ({ id, name, description, price, image, available, isVeg, spiceLevel }) => {
  const { items, addItem, updateQuantity } = useCartStore();
  
  const cartItem = items.find(i => i.id === id);
  const quantity = cartItem?.quantity || 0;

  return (
    <div className={cn(
      "flex gap-4 p-4 bg-white rounded-2xl shadow-sm border border-stone-100 transition-all",
      !available && "opacity-60 grayscale"
    )}>
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg text-stone-800">{name}</h3>
            <div className="flex items-center gap-1 shrink-0 mt-1">
              {isVeg !== undefined && (
                <div className={cn(
                  "w-4 h-4 border flex items-center justify-center rounded-sm",
                  isVeg ? "border-green-600" : "border-red-600"
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isVeg ? "bg-green-600" : "bg-red-600"
                  )} />
                </div>
              )}
              {spiceLevel !== undefined && spiceLevel > 0 && (
                <div className="flex">
                  {Array.from({ length: spiceLevel }).map((_, i) => (
                    <Flame key={i} className="w-3 h-3 text-red-500 fill-red-500" />
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-emerald-700 font-medium mt-1">₹{price}</p>
          {description && (
            <p className="text-sm text-stone-500 mt-2 line-clamp-2">{description}</p>
          )}
        </div>
        
        <div className="mt-4">
          {!available ? (
            <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded">Currently Unavailable</span>
          ) : quantity === 0 ? (
            <button 
              onClick={() => addItem({ id, name, price, image })}
              className="px-6 py-2 bg-emerald-50 text-emerald-700 font-medium rounded-full text-sm hover:bg-emerald-100 transition-colors"
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-emerald-50 w-fit rounded-full p-1">
              <button 
                onClick={() => updateQuantity(id, quantity - 1)}
                className="w-8 h-8 flex items-center justify-center bg-white text-emerald-700 rounded-full shadow-sm"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-medium text-emerald-800 w-4 text-center">{quantity}</span>
              <button 
                onClick={() => updateQuantity(id, quantity + 1)}
                className="w-8 h-8 flex items-center justify-center bg-white text-emerald-700 rounded-full shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {image && (
        <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden bg-stone-100">
          <img src={image} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}
    </div>
  );
};

export default MenuItemCard;
