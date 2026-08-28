# Phase 8 Context: Frontend

## Domain
Frontend (Next.js storefront: browse, cart, checkout with polling confirmation, order history through same-origin proxy).

## Locked Requirements
Requirements are defined in `REQUIREMENTS.md`. This phase implements FRNT-01 through FRNT-07. UI Considerations and Design tokens are locked in `08-UI-SPEC.md`.

## Canonical References
- `docs/api-contracts/` (OpenAPI specs for backend)
- `.planning/phases/8-frontend/08-UI-SPEC.md`

## Decisions
- **Next.js Proxying & JWT handling:** Use Next.js Route Handlers for login to set the cookie, and Next.js Rewrites for standard traffic (attaching auth via middleware if needed).
- **State Management:** Zustand — Lightweight, less boilerplate, avoids Context re-render hell, very common in Next.js apps.
- **Data Fetching & Polling:** React Query (or SWR) — Built-in polling, caching, and automatic revalidation make this much easier to write and maintain.
- **Cart Synchronization:** Pessimistic UI (Wait for server) — Since totals must be computed server-side from live catalog prices (CART-02), waiting for the server ensures our totals are always perfectly accurate.

## Codebase Assets & Patterns
- Standard `shadcn/ui` integration with `b6ld6pYGrA` preset (locked by UI-SPEC).
- Next.js 16.3.2 App Router.
