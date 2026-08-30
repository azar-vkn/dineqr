# Phase 3 — Multi-Tenant SaaS (working spec)

Turn DineQR from a single-restaurant app into a platform you (the provider)
operate for many restaurants, each with fully private data.

## Decisions (locked)
- **Isolation:** pooled single Firestore, **subcollections per restaurant** under
  `restaurants/{restaurantId}/…`, isolation enforced by **custom-claims** security
  rules. (Not database-per-tenant.)
- **Payments:** each restaurant connects **their own Razorpay account** (key stored
  in their tenant doc). You are not a payment aggregator.
- **Plan:** Blaze (already enabled).

## Data model
```
restaurants/{restaurantId}
    name, address, gstRate, timezone, branding{primaryColor,logoUrl},
    razorpayKeyId, status: active|suspended,
    subscription{plan,status,renewsAt}, createdAt
    ├── menu/{itemId}
    ├── orders/{orderId}
    ├── bills/{billId}
    ├── tables/{tableId}
    ├── purchases/{id}
    ├── counters/{doc}          # bill numbers, scoped per restaurant
    ├── reports/{date}          # daily revenue reports
    ├── feedback/{orderId}
    ├── menuRatings/{itemId}
    └── staff/{uid}             # membership + display info

platform/                       # provider-only
    admins/{uid}
    billingInvoices/{id}        # what each restaurant owes YOU

users/{uid}                     # uid → { restaurantId, role } mirror of claims
```

## Identity & access (custom claims)
- Restaurant staff → `{ restaurantId, role: "admin"|"staff"|"cook" }`
- Provider team → `{ platformAdmin: true }` (access across all restaurants)
- Customers → **unauthenticated**; tenant comes from the QR URL
  `/#/r/{restaurantId}/table/{tableId}`.

Rules reduce to one pattern:
```
match /restaurants/{rid}/{document=**} {
  allow read, write: if request.auth.token.restaurantId == rid
                     || request.auth.token.platformAdmin == true;
}
// + narrow public rules: menu read + order create scoped to {rid}
```

## Onboarding ("easy install")
1. Provider console → **Add restaurant** → `createRestaurant` creates the tenant
   doc + returns `restaurantId`.
2. `assignUserToRestaurant` stamps the first admin's claims (they must have signed
   in once, or be invited).
3. Admin logs in (web or the identical desktop installer — tenant is decided by
   login), sets up menu / tables / their Razorpay key, prints QR codes.

> Claims only take effect after the user's ID token refreshes — client calls
> `getIdToken(true)` (or re-login) after being assigned.

## Build increments
1. **Foundation (this increment, non-breaking):** tenant types, `restaurants`
   model, claims-provisioning functions (`createRestaurant`,
   `assignUserToRestaurant`, `claimPlatformAdmin`).
2. **Isolation:** rewrite Firestore/Storage rules for path scoping; tenant-scope
   every client query; tenant-aware QR routing.
3. **Payments & onboarding:** functions read the calling restaurant's Razorpay
   key; provider console + restaurant self-setup.
4. **Go live:** migrate the current single restaurant's data into
   `restaurants/{firstId}/…` (Admin SDK script, **dry-run first**), then
   subscription billing.

## Safe rollout
- All work on the **`phase3-multitenant` branch**.
- Test against a staging tenant (current restaurant becomes tenant #1).
- Migration runs **dry-run** first; real cut-over only with explicit approval.
- Nothing touches the live app until the migration step.

## Progress (branch `phase3-multitenant`, NOT deployed)
Done + committed:
- ✅ **Increment 1** — tenant model, types, provisioning functions
  (`createRestaurant`, `assignUserToRestaurant`, `claimPlatformAdmin`)
- ✅ **Increment 2 (client)** — every customer + admin read/write scoped to
  `restaurants/{rid}/…` (legacy fallback); tenant routing + tenant-aware QR
- ✅ **Increment 2 (rules)** — `firestore.rules` claims-based isolation for
  `restaurants/{rid}/…` + `platform/**` (⚠️ NOT emulator-validated yet)
- ✅ **Increment 3** — payment functions read per-tenant menu + Razorpay keys;
  `onTenantOrderCreated` bill trigger for `restaurants/{rid}/orders`

## Finish-line runbook (remaining go-live work)
1. **Validate rules** — install Java, then
   `firebase emulators:exec --only firestore "npm run test:rules"` (write rules
   unit tests with `@firebase/rules-unit-testing`). Do NOT deploy rules unvalidated.
2. **Auth cutover** — switch `AdminLayout` gate from `useUserRole` (Firestore
   users doc) to `useTenant` (claims); rework `AdminStaff` to list
   `restaurants/{rid}/staff` and add members via `assignUserToRestaurant`.
   (Breaking until claims exist — test on a staging tenant.)
2b. **Storage rules** — scope `menu`/onboarding images per tenant.
3. **Provider onboarding console** — small UI to call `createRestaurant` +
   `assignUserToRestaurant`, and to set a tenant's Razorpay secret into
   `restaurants/{rid}/private/razorpay` (Admin-SDK-written).
4. **Per-tenant** `dailyRevenueReport` (iterate `restaurants`), subscription billing.
5. **Migration** — Admin SDK script: copy top-level `orders/menu/bills/…` into
   `restaurants/{firstId}/…`, set the first admin's claims, **dry-run first**,
   review, then execute. Set `PLATFORM_ADMIN_EMAIL` in `functions/.env`.
6. **Coordinated deploy** — functions + rules + hosting together, after staging
   sign-off. Then bootstrap platform-admin (`claimPlatformAdmin`) and onboard.

## Legal / business (parallel track, not code)
- Registered entity; **Terms of Service + Privacy Policy + Data Processing
  Agreement** (you process diners' data); **GST** registration for subscription fees.
- Per-restaurant Razorpay keeps you out of payment-aggregator regulation.
