---
status: testing
phase: 06-notification-service
source: [06-SUMMARY.md]
started: 2026-08-28T17:23:00+05:30
updated: 2026-08-28T17:23:00+05:30
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

### 2. Order Confirmation Email
expected: Produce an `order.created` event and verify the "Order {orderId} confirmed" email arrives in Mailpit (via its REST API or UI).
result: pending

### 3. Payment Failed Email
expected: Produce a `payment.completed` event (with `DECLINED` outcome) and verify the "Order {orderId} payment failed" email arrives.
result: pending

### 4. Duplicate Event Ignored
expected: Re-produce an event with the same `eventId` and assert that no duplicate email is sent.
result: pending

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0

## Gaps
