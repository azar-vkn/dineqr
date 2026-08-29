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
  orderType: 'dine' | 'parcel' | null;
  lastOrderId: string | null;
  lastTrackingToken: string | null;
  lastOrderAt: number | null;
  recentOrderIds: string[];
  cartUpdatedAt: number | null;
  items: CartItem[];
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (name: string) => void;
  setOrderType: (type: 'dine' | 'parcel') => void;
  setLastOrderId: (orderId: string | null, trackingToken?: string | null) => void;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  isCartStale: () => boolean;
  hasActiveOrder: () => boolean;
}

const CART_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const ORDER_TRACKING_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RECENT_ORDERS = 5;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tableNumber: null,
      customerName: null,
      orderType: null,
      lastOrderId: null,
      lastTrackingToken: null,
      lastOrderAt: null,
      recentOrderIds: [],
      cartUpdatedAt: null,
      items: [],
      setTableNumber: (tableNumber) => set((state) => {
        // If switching to a different table, clear everything to prevent cross-contamination
        if (state.tableNumber && state.tableNumber !== tableNumber) {
          return { tableNumber, customerName: null, orderType: null, lastOrderId: null, items: [], cartUpdatedAt: null };
        }
        return { tableNumber };
      }),
      setCustomerName: (customerName) => set({ customerName }),
      setOrderType: (orderType) => set({ orderType }),
      setLastOrderId: (lastOrderId, trackingToken) => set((state) => {
        if (lastOrderId === null) return { lastOrderId, lastTrackingToken: null, lastOrderAt: null };
        // Track recent orders (deduplicated, max 5)
        const recent = [lastOrderId, ...state.recentOrderIds.filter(id => id !== lastOrderId)].slice(0, MAX_RECENT_ORDERS);
        return { lastOrderId, lastTrackingToken: trackingToken || null, lastOrderAt: Date.now(), recentOrderIds: recent };
      }),
      addItem: (item) => set((state) => {
        const existingItem = state.items.find(i => i.id === item.id);
        if (existingItem) {
          return {
            cartUpdatedAt: Date.now(),
            items: state.items.map(i => 
              i.id === item.id ? { ...i, quantity: Math.min(50, Math.floor(i.quantity + 1)) } : i
            )
          };
        }
        return { cartUpdatedAt: Date.now(), items: [...state.items, { ...item, quantity: 1 }] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id),
        cartUpdatedAt: state.items.length > 1 ? state.cartUpdatedAt : null,
      })),
      updateQuantity: (id, quantity) => set((state) => {
        if (quantity <= 0) {
          return { items: state.items.filter(i => i.id !== id) };
        }
        return {
          cartUpdatedAt: Date.now(),
          items: state.items.map(i => 
            i.id === id ? { ...i, quantity: Math.min(50, Math.floor(quantity)) } : i
          )
        };
      }),
      clearCart: () => set({ items: [], cartUpdatedAt: null }),  // Note: lastOrderId is intentionally NOT cleared here
      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
      isCartStale: () => {
        const { cartUpdatedAt, items } = get();
        if (!cartUpdatedAt || items.length === 0) return false;
        return Date.now() - cartUpdatedAt > CART_EXPIRY_MS;
      },
      hasActiveOrder: () => {
        const { lastOrderId, lastOrderAt } = get();
        if (!lastOrderId || !lastOrderAt) return false;
        // Auto-expire after 2 hours
        return Date.now() - lastOrderAt < ORDER_TRACKING_EXPIRY_MS;
      },
    }),
    {
      name: 'dineqr-cart-storage',
    }
  )
);
