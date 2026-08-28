---
phase: 8
slug: frontend
---
# Phase 8 Plan: Frontend

## must_haves
- [FRNT-01] Storefront provides browse, product detail page, category filter, and text search views
- [FRNT-02] Cart page supports quantity updates/removals with live totals
- [FRNT-03] Signup/login UI works; JWT held in httpOnly cookie via Next.js server-side proxy
- [FRNT-04] Checkout flow shows an order summary before confirming and submits with an idempotency key
- [FRNT-05] Confirmation page polls order status until terminal state and renders both outcomes
- [FRNT-06] User can view order history and order detail pages
- [FRNT-07] Logout link clears the session client-side

## Wave 1: Tracer Slice (Scaffold & Auth)
- [ ] **Task 8.1.1**: Scaffold Next.js 16.3.2 App Router inside `services/frontend/`. Initialize shadcn/ui with `b6ld6pYGrA` preset.
- [ ] **Task 8.1.2**: Configure Next.js rewrites in `next.config.js` to proxy `/api/*` to the API gateway (`http://localhost:8080`).
- [ ] **Task 8.1.3**: Implement Signup and Login pages. Create Route Handler `/api/auth/login` to fetch JWT and set as `httpOnly` cookie on response. Add middleware to attach token to proxy requests.
- [ ] **Task 8.1.4**: End-to-End Verification: Start the backend, attempt login, and verify the `httpOnly` cookie is set and downstream requests succeed.

## Wave 2: Catalog
- [ ] **Task 8.2.1**: Implement Product List page (`/`) using React Query fetching from `/api/catalog/products`.
- [ ] **Task 8.2.2**: Implement Search and Category Filters, syncing state with URL query params.
- [ ] **Task 8.2.3**: Implement Product Detail page (`/products/[id]`).

## Wave 3: Cart
- [ ] **Task 8.3.1**: Implement Cart page/drawer with React Query fetching from `/api/cart`.
- [ ] **Task 8.3.2**: Implement Add, Update Quantity, and Remove Item mutations. Use Pessimistic UI updates (wait for server response before updating cache to guarantee correct totals).

## Wave 4: Checkout & Order Polling
- [ ] **Task 8.4.1**: Implement Checkout page with order summary.
- [ ] **Task 8.4.2**: Implement Checkout submission, generating and sending an `Idempotency-Key` header.
- [ ] **Task 8.4.3**: Implement Order Confirmation page that polls `/api/orders/[id]` via React Query `refetchInterval` until status is `PAID` or `PAYMENT_FAILED`, rendering appropriate UI.

## Wave 5: Order History & User Profile
- [ ] **Task 8.5.1**: Implement Order History list and individual detail view.
- [ ] **Task 8.5.2**: Implement Logout functionality to clear the session cookie client-side.
