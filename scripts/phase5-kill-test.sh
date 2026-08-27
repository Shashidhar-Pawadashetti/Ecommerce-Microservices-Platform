#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# phase5-kill-test.sh — ORDR-08 crash-recovery test for the order→payment saga.
#
# Proves at-least-once redelivery is handled without double-charging:
#   1. Bring the full Phase 5 stack up.
#   2. Checkout an order (order.created published).
#   3. KILL payment-service BEFORE it can consume the event.
#   4. Assert the order stays PENDING_PAYMENT (no payment processed while down).
#   5. RESTART payment-service — it re-reads the retained order.created from its
#      committed offset, and the SETNX dedup in payment-service guarantees exactly
#      ONE payment.completed is produced.
#   6. Assert the order reaches PAID (never PAYMENT_FAILED) — recovery succeeded.
#
# The "exactly-once charge" guarantee is enforced by the Redis SETNX dedup, which
# is unit-tested in payment-service/tests/test_saga.py (test_dedup_redelivery_no_
# double_produce). This script proves the process-level recovery end-to-end.
#
# Requires: `docker compose up` of the full stack already healthy (or pass
# BRING_UP=1 to let the script start it).
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

AUTH="http://localhost:8081"
CART="http://localhost:3001"
ORDER="http://localhost:8082"
BRING_UP="${BRING_UP:-0}"

if [ "$BRING_UP" = "1" ]; then
  echo "== bringing stack up (BRING_UP=1) =="
  docker compose up -d kafka postgres redis auth-service cart-service order-service payment-service
fi

wait_health() {
  local url="$1" name="$2" i=0
  echo "Waiting for $name ($url)..."
  until curl -fsS "$url" >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -gt 90 ] && { echo "TIMEOUT $name"; exit 1; }
    sleep 2
  done
  echo "$name is up."
}

wait_health "$ORDER/actuator/health" "order-service"

# 1) Signup + login
EMAIL="kill-$(date +%s)@example.com"
PASSWORD="Password123!"
curl -fsS -X POST "$AUTH/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
TOKEN=$(curl -fsS -X POST "$AUTH/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

# 2) Add item
curl -fsS -X POST "$CART/cart/items" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"productId":"prod-1001","quantity":1}' >/dev/null

# 3) Checkout
IDEM="kill-$(python -c 'import uuid;print(uuid.uuid4().hex)')"
ORDER_ID=$(curl -fsS -X POST "$ORDER/orders" -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEM" \
  | python -c 'import sys,json;print(json.load(sys.stdin)["orderId"])')
echo "== created order $ORDER_ID =="

# 3b) KILL payment-service before it can consume order.created
echo "== KILLING payment-service (simulating crash before consume) =="
docker compose kill payment-service
sleep 3

# 4) Assert still PENDING_PAYMENT while payment is down
STATUS=$(curl -fsS "$ORDER/orders/$ORDER_ID" -H "Authorization: Bearer $TOKEN" \
  | python -c 'import sys,json;print(json.load(sys.stdin)["status"])')
echo "== status after kill (expect PENDING_PAYMENT): $STATUS =="
if [ "$STATUS" != "PENDING_PAYMENT" ]; then
  echo "FAIL: order changed state while payment was down ($STATUS)"; exit 1
fi

# 5) Restart payment-service — it re-reads the retained event; SETNX dedups.
echo "== RESTARTING payment-service =="
docker compose restart payment-service
# give it time to reconnect to Kafka
sleep 10

# 6) Assert it reaches PAID (recovery), never PAYMENT_FAILED
FINAL="PENDING_PAYMENT"
for i in $(seq 1 30); do
  FINAL=$(curl -fsS "$ORDER/orders/$ORDER_ID" -H "Authorization: Bearer $TOKEN" \
    | python -c 'import sys,json;print(json.load(sys.stdin)["status"])')
  echo "  status=$FINAL"
  if [ "$FINAL" = "PAID" ] || [ "$FINAL" = "PAYMENT_FAILED" ]; then break; fi
  sleep 2
done

if [ "$FINAL" != "PAID" ]; then
  echo "FAIL: order did not recover to PAID (got $FINAL)"; exit 1
fi

echo "PASS: order $ORDER_ID recovered to PAID after payment-service kill+restart (ORDR-08)."
exit 0
