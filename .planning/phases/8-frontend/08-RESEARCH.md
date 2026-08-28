# Phase 8 Research: Frontend Architecture

## Domain Analysis
This phase implements the Next.js storefront (FRNT-01 through FRNT-07). The frontend is the sole entry point for users and interacts exclusively with the Spring Cloud Gateway (Phase 7) at `localhost:8080`.

## Architecture & Integration Strategy

### 1. Next.js Proxying & JWT Handling (FRNT-03)
**Requirement**: JWT must be held in an `httpOnly` cookie via Next.js server-side proxy (same-origin; no CORS surface).
- **Login Flow**: The client submits credentials to a Next.js Route Handler (`/api/auth/login`). The Route Handler forwards the request to the API Gateway (`http://localhost:8080/auth/login`). Upon success, it extracts the JWT from the response and sets an `httpOnly` cookie on the Next.js response.
- **Proxying**: We will use Next.js Rewrites in `next.config.js` to proxy `/api/gateway/:path*` to `http://localhost:8080/:path*`. Since the gateway requires the JWT in the `Authorization` header, we can use Next.js Middleware to intercept requests to `/api/gateway/*`, read the `httpOnly` cookie, and attach it as a `Bearer` token before the rewrite occurs.

### 2. State Management (Zustand)
- **Scope**: Zustand will manage lightweight client-side UI state (e.g., mobile menu toggles, modal visibility) and transient data.
- **Why**: Zustand avoids Context re-render hell and is less boilerplate-heavy than Redux. Since React Query handles server state, Zustand is strictly for client-only state.

### 3. Data Fetching & Polling (React Query)
- **Scope**: Data fetching, caching, and polling will be managed by React Query (`@tanstack/react-query`).
- **Why**: React Query excels at handling server state. It provides built-in mechanisms for caching (useful for catalog browsing) and, crucially, polling (required for FRNT-05: polling order status until terminal state). SWR is an alternative, but React Query offers more robust mutation and cache invalidation APIs which will be useful for cart and order operations.

### 4. Cart Synchronization (Pessimistic UI)
- **Scope**: Cart additions, quantity updates, and removals (FRNT-02).
- **Strategy**: We will use a Pessimistic UI approach. Since cart totals must be computed server-side from live catalog prices, the client cannot predict the final total accurately. When a user updates their cart, the UI will show a loading state (e.g., a spinner or skeleton) and wait for the server's response before updating the displayed cart contents and totals.

## Dependencies & Tools
- `next` (v16.3.2 App Router)
- `react-query` (Data fetching & polling)
- `zustand` (Client state)
- `shadcn/ui` (Component library, preset locked by `08-UI-SPEC.md`)
- `lucide-react` (Icons)
- `zod` & `react-hook-form` (Forms and validation)
