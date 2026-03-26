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
  lastOrderId: string | null;
  items: CartItem[];
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (name: string) => void;
  setLastOrderId: (orderId: string | null) => void;
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
      lastOrderId: null,
      items: [],
      setTableNumber: (tableNumber) => set((state) => {
        // If switching to a different table, clear everything to prevent cross-contamination
        if (state.tableNumber && state.tableNumber !== tableNumber) {
          return { tableNumber, customerName: null, lastOrderId: null, items: [] };
        }
        return { tableNumber };
      }),
      setCustomerName: (customerName) => set({ customerName }),
      setLastOrderId: (lastOrderId) => set({ lastOrderId }),
      addItem: (item) => set((state) => {
        const existingItem = state.items.find(i => i.id === item.id);
        if (existingItem) {
          return {
            items: state.items.map(i => 
              i.id === item.id ? { ...i, quantity: Math.min(50, Math.floor(i.quantity + 1)) } : i
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
        return {
          items: state.items.map(i => 
            i.id === id ? { ...i, quantity: Math.min(50, Math.floor(quantity)) } : i
          )
        };
      }),
      clearCart: () => set({ items: [] }),  // Note: lastOrderId is intentionally NOT cleared here
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
