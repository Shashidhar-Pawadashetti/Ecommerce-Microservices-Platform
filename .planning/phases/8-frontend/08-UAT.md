---
status: testing
phase: 08-frontend
source: [08-PLAN.md]
started: 2026-08-28T13:30:00Z
updated: 2026-08-28T13:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pending

### 2. Signup and Login
expected: User can sign up and log in. The application sets an httpOnly cookie and routes requests to the backend.
result: pending

### 3. Product Catalog
expected: User can view a list of products, view product details, and filter/search products.
result: pending

### 4. Cart Operations
expected: User can add items, update quantities, and remove items with live server-calculated totals.
result: pending

### 5. Checkout and Order Polling
expected: User can checkout, see an order summary, and the confirmation page polls until the status is PAID or PAYMENT_FAILED.
result: pending

### 6. Order History and Logout
expected: User can view past orders, order details, and log out.
result: pending

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

