#!/usr/bin/env bash
# smoke-auth.sh — standalone live-behavior smoke test for auth-service (D-10).
#
# Runs against a LIVE stack (default http://localhost:8081, the transitional
# direct port used in Phases 2–6) and asserts the full contracted surface:
#   1. signup with a fresh random-suffix email      -> 201
#   2. immediate replay of the identical payload    -> 409 (DUPLICATE_EMAIL)
#   3. login with a wrong password                  -> 401 (UNAUTHORIZED)
#   4. login with correct credentials               -> 200 + non-empty accessToken
#   5. GET /auth/me WITH the bearer token           -> 200
#   6. GET /auth/me WITHOUT any token               -> 401
#   7. POST /auth/logout WITH the bearer token      -> 404 or 405
#      (the third write operation is ABSENT by frozen contract D-03; accepting
#       either status tolerates framework routing differences while still
#       proving no logout endpoint serves the route)
#
# JSON-parser-free by design (no JSON query tool exists on the host): every assertion reads ONLY HTTP
# status codes via `curl -s -o /dev/null -w '%{http_code}'`; the single body
# read lifts the accessToken with one sed expression. Statuses and verdicts
# are printed — never token values or response bodies.
#
# Exit codes: 0 = ALL PASS, non-zero = first failed step (labeled FAIL).
#
# Phase 9 chains this script into the zero-manual-steps E2E alongside its
# future sibling smoke scripts (one per service).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE="${AUTH_BASE_URL:-http://localhost:8081}"

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== smoke-auth: live auth-service behavior gate =="
echo "-- target: ${BASE}"

# Shared fixtures: a fresh identity so reruns never collide with prior runs.
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
PASSWORD="correct-horse-battery"
WRONG_PASSWORD="wrong-horse-battery"

SIGNUP_PAYLOAD="{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
LOGIN_BAD="{\"email\":\"${EMAIL}\",\"password\":\"${WRONG_PASSWORD}\"}"
LOGIN_OK="{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"

# ------------------------------------------------------------- step 1 signup
echo "-- step 1: signup expects 201"
[ "$(code -X POST "${BASE}/auth/signup" -H 'Content-Type: application/json' \
     -d "${SIGNUP_PAYLOAD}")" = 201 ] || { echo "FAIL: step 1 signup did not return 201"; exit 1; }
echo "   ok: 201"

# -------------------------------------------------- step 2 duplicate rejection
echo "-- step 2: immediate replay expects 409 DUPLICATE_EMAIL"
[ "$(code -X POST "${BASE}/auth/signup" -H 'Content-Type: application/json' \
     -d "${SIGNUP_PAYLOAD}")" = 409 ] || { echo "FAIL: step 2 duplicate signup did not return 409"; exit 1; }
echo "   ok: 409"

# ------------------------------------------------------ step 3 wrong password
echo "-- step 3: login with wrong password expects 401"
[ "$(code -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
     -d "${LOGIN_BAD}")" = 401 ] || { echo "FAIL: step 3 wrong-password login did not return 401"; exit 1; }
echo "   ok: 401"

# ------------------------------------------------------- step 4 login success
echo "-- step 4: login with correct credentials expects 200 + non-empty accessToken"
[ "$(code -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
     -d "${LOGIN_OK}")" = 200 ] || { echo "FAIL: step 4 login did not return 200"; exit 1; }
TOKEN="$(curl -s -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
     -d "${LOGIN_OK}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
[ -n "${TOKEN}" ] || { echo "FAIL: step 4 login body carried no accessToken"; exit 1; }
echo "   ok: 200 + token extracted (value not printed)"

# ------------------------------------------------------------ step 5 me (auth)
echo "-- step 5: GET /auth/me WITH bearer token expects 200"
[ "$(code "${BASE}/auth/me" -H "Authorization: Bearer ${TOKEN}")" = 200 ] || { echo "FAIL: step 5 authenticated /me did not return 200"; exit 1; }
echo "   ok: 200"

# --------------------------------------------------------- step 6 me (anon)
echo "-- step 6: GET /auth/me WITHOUT any token expects 401"
[ "$(code "${BASE}/auth/me")" = 401 ] || { echo "FAIL: step 6 anonymous /me did not return 401"; exit 1; }
echo "   ok: 401"

# ------------------------------------------- step 7 logout route is ABSENT
echo "-- step 7: POST /auth/logout WITH bearer expects 404 or 405 (operation absent per D-03)"
LOGOUT_CODE="$(code -X POST "${BASE}/auth/logout" -H "Authorization: Bearer ${TOKEN}")"
if [ "${LOGOUT_CODE}" = 404 ] || [ "${LOGOUT_CODE}" = 405 ]; then
  echo "   ok: ${LOGOUT_CODE} (no server logout exists)"
else
  echo "FAIL: step 7 /auth/logout answered ${LOGOUT_CODE}; frozen contract D-03 forbids a served logout route (expected 404 or 405)"
  exit 1
fi

echo "== smoke-auth: ALL PASS (7/7 steps green against ${BASE}) =="
