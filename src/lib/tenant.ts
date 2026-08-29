// ── Tenant-scoped Firestore path helpers (Phase 3) ────────────
// Every restaurant's data lives under restaurants/{restaurantId}/…, so all
// reads/writes go through these helpers instead of top-level collections.
// This keeps one restaurant from ever touching another's data.

import {
  collection,
  doc,
  type Firestore,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";

/** The tenant doc itself: restaurants/{restaurantId} */
export function restaurantDoc(db: Firestore, restaurantId: string): DocumentReference {
  return doc(db, "restaurants", restaurantId);
}

/** A subcollection under a tenant: restaurants/{restaurantId}/{name} */
export function tenantCollection(
  db: Firestore,
  restaurantId: string,
  name: string
): CollectionReference {
  return collection(db, "restaurants", restaurantId, name);
}

/** A doc in a tenant subcollection: restaurants/{restaurantId}/{name}/{id} */
export function tenantDoc(
  db: Firestore,
  restaurantId: string,
  name: string,
  id: string
): DocumentReference {
  return doc(db, "restaurants", restaurantId, name, id);
}
