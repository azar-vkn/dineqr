import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartState {
  tableNumber: string | null;
  customerName: string | null;
  items: CartItem[];
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (name: string) => void;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tableNumber: null,
      customerName: null,
      items: [],
      setTableNumber: (tableNumber) => set((state) => {
        if (state.tableNumber !== null && state.tableNumber !== tableNumber) {
          return { tableNumber, items: [] };
        }
        return { tableNumber };
      }),
      setCustomerName: (customerName) => set({ customerName }),
      addItem: (item) => set((state) => {
        if (item.price < 0) return state; // Reject negative prices
        const existingItem = state.items.find(i => i.id === item.id);
        if (existingItem) {
          return {
            items: state.items.map(i => 
              i.id === item.id ? { ...i, quantity: Math.min(50, i.quantity + 1) } : i
            )
          };
        }
        return { items: [...state.items, { ...item, quantity: 1 }] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      updateQuantity: (id, quantity) => set((state) => {
        if (quantity <= 0) {
          return { items: state.items.filter(i => i.id !== id) };
        }
        const clampedQuantity = Math.min(50, Math.floor(quantity));
        return {
          items: state.items.map(i => 
            i.id === id ? { ...i, quantity: clampedQuantity } : i
          )
        };
      }),
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + (item.price * item.quantity), 0);
      }
    }),
    {
      name: 'dineqr-cart-storage',
    }
  )
);
