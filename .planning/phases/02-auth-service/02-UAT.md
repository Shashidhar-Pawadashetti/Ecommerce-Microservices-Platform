---
status: testing
phase: 02-auth-service
source: [02-VERIFICATION.md]
started: 2026-08-25T19:30:00Z
updated: 2026-08-25T19:30:00Z
---

## Current Test

number: 1
name: Race-backstop duplicate translation (DataIntegrityViolationException → contracted 409)
expected: |
  Force a real `users_email_uniq` unique-index violation past the findByEmail pre-check
  (e.g., transactional race harness, or a slice test that saves inside the pre-check window).
  Response must be HTTP 409 with body {"code":"DUPLICATE_EMAIL","message":"An account with this email already exists."}
  — byte-identical to the fast-path envelope — never a 500.
awaiting: user response

## Tests

### 1. Race-backstop duplicate translation (required)
expected: 409 DUPLICATE_EMAIL envelope (byte-identical to fast path), never 500, when a unique-index violation escapes the pre-check
result: [pending]

### 2. README operator-readability skim (optional, plan 02-04 D5)
expected: services/auth-service/README.md reads clearly for an operator; logout-as-client-side-token-discard policy is stated unambiguously
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
