import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-error";
import type { Order, OrderStatus } from "../types";

interface UseOrdersOptions {
  /** Max number of orders to fetch. Default: 100 */
  maxOrders?: number;
  /** Only fetch orders with these statuses. Default: all */
  statusFilter?: OrderStatus[];
  /** Order direction. Default: "desc" */
  direction?: "asc" | "desc";
}

interface UseOrdersReturn {
  orders: Order[];
  loading: boolean;
  /** Count of orders matching filter */
  count: number;
}

/**
 * Real-time Firestore orders subscription with optional filtering & pagination.
 * Replaces the duplicated onSnapshot logic in AdminDashboard, AdminHistory, AdminStats.
 */
export function useOrders(options: UseOrdersOptions = {}): UseOrdersReturn {
  const {
    maxOrders = 100,
    statusFilter,
    direction = "desc",
  } = options;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable reference for statusFilter to avoid re-subscribing on every render
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;

  useEffect(() => {
    const constraints: QueryConstraint[] = [
      orderBy("createdAt", direction),
      limit(maxOrders),
    ];

    // Add status filter if provided
    if (statusFilter && statusFilter.length > 0 && statusFilter.length <= 10) {
      constraints.push(where("status", "in", statusFilter));
    }

    const q = query(collection(db, "orders"), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((doc) => {
          fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
        });
        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, "orders");
      }
    );

    return () => unsubscribe();
  }, [maxOrders, direction, statusFilter?.join(",")]);

  return { orders, loading, count: orders.length };
}
