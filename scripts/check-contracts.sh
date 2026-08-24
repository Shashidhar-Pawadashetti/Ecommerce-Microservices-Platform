#!/usr/bin/env bash
# check-contracts.sh — Phase 1 mechanical contract drift gate.
#
# Validates all five CONTR dimensions mechanically; exits non-zero on ANY
# violation:
#   1. LINT          — Spectral CLI 6.16.3 over docs/api-contracts/*.openapi.yaml
#                      (--fail-severity=warn, so warnings are fatal)
#   2. TOPIC SCHEMAS — fenced-JSON payload validation of docs/kafka-topics.md
#                      via scripts/validate-topic-schemas.mjs (Node stdlib)
#   3. EOL LAW       — no CRLF in the git index on governed paths (*.bat/*.cmd exempt)
#   4. MANIFEST      — docs/versions.md carries every pinned component + a
#                      verified-date footer line
#   5. SPEC COVERAGE — per-spec operation assertions (auth spec must expose
#                      signup, login, me from Plan 03 onward)
#
# Existence-guarded for incremental waves BY DESIGN: files authored by later
# plans in this same phase (docs/versions.md -> Plan 03, docs/kafka-topics.md
# -> Plan 05, catalog/cart/orders specs -> Plans 04-05) legitimately do not
# exist yet at wave start, so their stages SKIP with a note instead of failing.
# Once a guarded file lands, its stage asserts at full strength — it never
# silently re-skips.
#
# Stages accumulate failures (FAIL=1) rather than aborting early, so one run
# reports every violation class before exiting non-zero.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0
fail() { echo "FAIL: $1"; FAIL=1; }
skip() { echo "SKIP: $1"; }

echo "== check-contracts: mechanical contract drift gate =="

# --------------------------------------------------------------- Stage 1 LINT
shopt -s nullglob
SPECS=(docs/api-contracts/*.openapi.yaml)
shopt -u nullglob

if [ "${#SPECS[@]}" -eq 0 ]; then
  skip "lint - no specs matching docs/api-contracts/*.openapi.yaml yet"
else
  echo "-- Stage 1: lint (${#SPECS[@]} spec(s)) with Spectral CLI"
  # Toolchain pinned per the package-legitimacy approval recorded for this plan
  # (Task 1 checkpoint). SCARF_ANALYTICS=false opts out of telemetry reporting.
  if ! SCARF_ANALYTICS=false npx -y @stoplight/spectral-cli@6.16.3 lint \
      "${SPECS[@]}" \
      --ruleset docs/api-contracts/.spectral.yaml \
      --fail-severity=warn; then
    fail "spectral lint reported findings at or above --fail-severity=warn"
  fi
fi

# ------------------------------------------------------ Stage 2 TOPIC SCHEMAS
echo "-- Stage 2: topic payload schema validation"
if ! node scripts/validate-topic-schemas.mjs docs/kafka-topics.md; then
  fail "kafka-topics.md payload schemas violate the topic contracts"
fi

# ------------------------------------------------------------ Stage 3 EOL LAW
echo "-- Stage 3: line-ending law (no CRLF in index on governed paths)"
CRLF_HITS="$(git ls-files --eol | grep 'i/crlf' | grep -vE '\.(bat|cmd)$' || true)"
if [ -n "$CRLF_HITS" ]; then
  fail "CRLF found in git index on governed paths:"
  printf '%s\n' "$CRLF_HITS"
else
  echo "   ok: zero i/crlf entries outside *.bat/*.cmd"
fi

# --------------------------------------------------------- Stage 4 MANIFEST
VERSIONS_FILE="docs/versions.md"
if [ ! -f "$VERSIONS_FILE" ]; then
  skip "manifest - ${VERSIONS_FILE} not authored yet (Plan 03); full pin assertions engage the moment it lands"
else
  echo "-- Stage 4: version-manifest completeness"
  assert_pin() {
    local label="$1" pattern="$2"
    if grep -qiE "$pattern" "$VERSIONS_FILE"; then
      echo "   ok: $label"
    else
      fail "manifest missing pin: $label"
    fi
  }
  assert_pin "Spring Boot 3.5.16"     'Spring Boot.*3\.5\.16'
  assert_pin "Spring Cloud 2025.0.3"  'Spring Cloud.*2025\.0\.3'
  assert_pin "JDK 21"                 '(JDK|Java).*\b21\b'
  assert_pin "FastAPI 0.141.1"        'FastAPI.*0\.141\.1'
  assert_pin "Pydantic 2.13.4"        'Pydantic.*2\.13\.4'
  assert_pin "Python 3.13"            'Python.*3\.13'
  assert_pin "Node 24"                'Node.*\b24\b'
  assert_pin "Express 5.2.1"          'Express.*5\.2\.1'
  assert_pin "ioredis 6.0.0"          'ioredis.*6\.0\.0'
  assert_pin "kafkajs 2.2.4"          'kafkajs.*2\.2\.4'
  assert_pin "nodemailer 9.0.5"       'nodemailer.*9\.0\.5'
  assert_pin "aiokafka 0.14.0"        'aiokafka.*0\.14\.0'
  assert_pin "pymongo >= 4.9"         'pymongo.*4\.'
  assert_pin "apache/kafka 4.2.1"     'apache/kafka.*4\.2\.1'
  assert_pin "postgres 18"            'postgres.*18'
  assert_pin "mongo 8.0"              'mongo.*8\.0'
  assert_pin "redis 8"                'redis.*\b8\b'
  assert_pin "Next.js 16.3.2"         '(Next\.js|next).*16\.3\.2'
  assert_pin "Mailpit"                'Mailpit'
  assert_pin "eclipse-temurin 21-jre" 'eclipse-temurin.*21-jre'
  if grep -qiE '[Vv]erified [0-9]{4}-[0-9]{2}-[0-9]{2}' "$VERSIONS_FILE"; then
    echo "   ok: verified-date footer"
  else
    fail "manifest missing 'verified YYYY-MM-DD' footer line"
  fi
fi

# ----------------------------------------------------- Stage 5 SPEC COVERAGE
echo "-- Stage 5: per-spec endpoint coverage"
AUTH_SPEC="docs/api-contracts/auth-service.openapi.yaml"
if [ -f "$AUTH_SPEC" ]; then
  for op in signup login getMe; do
    if grep -qE "operationId:[[:space:]]*${op}[[:space:]]*$" "$AUTH_SPEC"; then
      echo "   ok: auth ${op}"
    else
      fail "auth spec missing operationId: ${op} (signup/login/me coverage)"
    fi
  done
else
  skip "spec coverage - ${AUTH_SPEC} not authored yet"
fi

for spec in docs/api-contracts/catalog-service.openapi.yaml \
            docs/api-contracts/cart-service.openapi.yaml \
            docs/api-contracts/orders-service.openapi.yaml; do
  if [ -f "$spec" ]; then
    if grep -q 'operationId:' "$spec"; then
      echo "   ok: $(basename "$spec") declares operations"
    else
      fail "$(basename "$spec") exists but declares no operationId"
    fi
  else
    skip "$(basename "$spec") not authored yet (Plans 04-05)"
  fi
done

echo "== check-contracts finished =="
exit "$FAIL"
