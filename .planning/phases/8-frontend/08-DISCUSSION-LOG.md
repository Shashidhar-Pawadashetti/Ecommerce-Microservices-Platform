# Phase 8 Discussion Log

- **Next.js Proxying & JWT handling:**
  - Selected: (Recommended) Use Next.js Route Handlers for login to set the cookie, and Next.js Rewrites for standard traffic (attaching auth via middleware if needed).
- **State Management:**
  - Selected: (Recommended) Zustand — Lightweight, less boilerplate, avoids Context re-render hell, very common in Next.js apps.
- **Data Fetching & Polling:**
  - Selected: (Recommended) React Query (or SWR) — Built-in polling, caching, and automatic revalidation make this much easier to write and maintain.
- **Cart Synchronization:**
  - Selected: (Recommended) Pessimistic UI (Wait for server) — Since totals must be computed server-side from live catalog prices (CART-02), waiting for the server ensures our totals are always perfectly accurate.
