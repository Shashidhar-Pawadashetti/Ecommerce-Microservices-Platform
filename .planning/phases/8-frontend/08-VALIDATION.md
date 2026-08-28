---
phase: 8
slug: frontend
date: 2026-08-28
---

# Phase 8 Validation Strategy: Frontend

This document outlines the testing and validation strategy for the Next.js storefront interacting with the API Gateway.

## Validation Architecture

### Automated Tests
1. **Component Testing (Jest & React Testing Library):**
   - Verify UI components render correctly in isolated environments.
   - Mock React Query hooks to test loading, error, and success states for `Catalog` and `Cart` components.

2. **Route Handlers / Proxy Testing:**
   - Verify that the `api/auth/login` route correctly proxies to the Gateway and forwards the `httpOnly` cookie.

### Manual UAT (User Acceptance Testing)

1. **Authentication (FRNT-03):**
   - Open browser dev tools and verify that the JWT is stored as an `httpOnly` cookie and is not accessible via JavaScript.
   - Click logout and verify the cookie is discarded and session ends.

2. **Catalog Browsing (FRNT-01):**
   - Verify the catalog list renders correctly without logging in.
   - Verify category filtering and text search works and updates the URL state.

3. **Cart Operations (FRNT-02):**
   - Log in. Add a product to the cart.
   - Verify pessimistic UI: increment quantity, ensure spinner/skeleton shows, and total updates *after* server response.

4. **Checkout & Polling (FRNT-04, FRNT-05):**
   - Complete checkout. Observe the confirmation page.
   - Verify the page polls the order status and stops polling when the state transitions to `PAID` or `PAYMENT_FAILED`.
   - Verify appropriate UI is rendered for both terminal outcomes.

5. **Order History (FRNT-06):**
   - Verify past orders are listed correctly and clicking an order shows detailed information.
