# Phase 07 UAT: API Gateway

## Goal

Verify that the API Gateway acts as the single ingress point, enforces JWT on protected routes, rates limits requests, and successfully isolates downstream services from the host.

## Success Criteria

1. **GTWY-01**: Gateway routes `/auth/**`, `/catalog/**`, `/cart/**`, and `/orders/**` to the correct downstream services.
2. **GTWY-02**: `/cart/**` and `/orders/**` return 401 without a valid JWT, pass with one, and reject forged/tampered tokens.
3. **GTWY-03**: `/auth/**` and `GET /catalog/**` respond normally with no token at all.
4. **GTWY-04**: From outside the Docker network, downstream services' ports are unreachable — only the gateway answers.
5. **GTWY-05**: Excessive request rates are throttled by the gateway rate limiter.

## UAT Script

### 1. Verification Setup

Ensure the infrastructure is up.

```bash
docker compose up -d
docker compose ps
```

### 2. GTWY-04: Network Isolation

Test that you cannot reach downstream services from the host, but you can reach the gateway.

```bash
# Gateway should be reachable
curl -i http://localhost:8080/actuator/health

# Auth service should NOT be reachable
curl -i http://localhost:8081/actuator/health

# Catalog service should NOT be reachable
curl -i http://localhost:8082/actuator/health

# Cart service should NOT be reachable
curl -i http://localhost:8083/actuator/health

# Order service should NOT be reachable
curl -i http://localhost:8084/actuator/health
```

### 3. GTWY-01 & GTWY-03: Routing and Public Endpoints

Test that public endpoints are accessible via the gateway without authentication.

```bash
# Auth Service (Signup/Login)
curl -s -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"uat-gateway@example.com","password":"password123"}'

# Catalog Service (Public read)
curl -s http://localhost:8080/catalog/products | grep '"items"'
```

### 4. GTWY-02: JWT Enforcement on Protected Routes

Test that protected routes are blocked without a token, and work with a valid token.

```bash
# Attempt to read cart without token (should be 401)
curl -i http://localhost:8080/cart

# Login to get a token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"uat-gateway@example.com","password":"password123"}' | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')

# Attempt to read cart with token (should pass)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/cart
```

### 5. GTWY-05: Rate Limiting

Send multiple requests rapidly to trigger the rate limiter (requires Redis).

```bash
# Send 20 quick requests
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/catalog/products
done
```
Expectation: Later requests return `429 Too Many Requests`.
