# Architecture — Ecommerce Microservices Platform

## System Overview

A polyglot e-commerce platform composed of **7 application services**, an **API gateway**, and a **Next.js frontend**, orchestrated locally via Docker Compose. Three language runtimes (Java/Spring Boot, Python/FastAPI, Node.js/Express) communicate through REST and Apache Kafka events, backed by three datastore types (PostgreSQL, MongoDB, Redis).

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser :3000"]
    end

    subgraph "Frontend"
        FE["Next.js 16.3<br/>App Router"]
    end

    subgraph "API Gateway"
        GW["Spring Cloud Gateway<br/>:8080<br/>JWT verify · Rate limiting"]
    end

    subgraph "Application Services"
        AUTH["auth-service<br/>Java/Spring Boot<br/>Signup · Login · JWT"]
        CAT["catalog-service<br/>Python/FastAPI<br/>Products · Search"]
        CART["cart-service<br/>Node.js/Express<br/>Cart CRUD · TTL"]
        ORD["order-service<br/>Java/Spring Boot<br/>Checkout · Status"]
        PAY["payment-service<br/>Python/FastAPI<br/>Mock payment saga"]
        NOTIF["notification-service<br/>Node.js/kafkajs<br/>Email worker"]
    end

    subgraph "Event Bus"
        KAFKA["Apache Kafka 4.2.1<br/>KRaft mode"]
    end

    subgraph "Datastores"
        PG["PostgreSQL 18<br/>users · orders"]
        MONGO["MongoDB 8.0<br/>products"]
        REDIS["Redis 8<br/>carts · rate limits"]
    end

    subgraph "Dev Tools"
        MAILPIT["Mailpit<br/>:8025 UI · :1025 SMTP"]
        KAFKAUI["Kafka UI<br/>:8088"]
    end

    Browser --> FE
    FE -->|"same-origin proxy<br/>/api/gateway/*"| GW
    GW -->|"/auth/**"| AUTH
    GW -->|"/catalog/**"| CAT
    GW -->|"/cart/**"| CART
    GW -->|"/orders/**"| ORD

    AUTH --> PG
    ORD --> PG
    CAT --> MONGO
    CART --> REDIS
    CART -->|"price validation"| CAT
    GW --> REDIS

    ORD -->|"order.created"| KAFKA
    KAFKA -->|"order.created"| PAY
    KAFKA -->|"order.created"| NOTIF
    PAY -->|"payment.completed"| KAFKA
    KAFKA -->|"payment.completed"| ORD
    KAFKA -->|"payment.completed"| NOTIF
    PAY --> REDIS

    NOTIF --> MAILPIT
    KAFKA -.-> KAFKAUI
```

## Service Map

| Service | Language | Framework | Port | Datastore | Purpose |
|---------|----------|-----------|------|-----------|---------|
| **frontend** | TypeScript | Next.js 16.3 (App Router) | 3000 | — | Storefront UI, httpOnly cookie auth |
| **api-gateway** | Java 21 | Spring Cloud Gateway 4.3 | 8080 | Redis (rate limiting) | Single ingress, JWT enforcement, routing |
| **auth-service** | Java 21 | Spring Boot 3.5 | 8081 (internal) | PostgreSQL (users) | Signup, login, JWT issuance |
| **catalog-service** | Python 3.13 | FastAPI 0.141 | 8000 (internal) | MongoDB (products) | Product CRUD, search, seed |
| **cart-service** | Node.js 24 | Express 5 | 3001 (internal) | Redis (carts) | Cart CRUD, server-side totals |
| **order-service** | Java 21 | Spring Boot 3.5 | 8082 (internal) | PostgreSQL (orders) | Checkout, order status, Kafka producer |
| **payment-service** | Python 3.13 | FastAPI 0.141 | 8083 (internal) | Redis (dedup) | Mock payment, Kafka consumer/producer |
| **notification-service** | Node.js 24 | kafkajs worker | — | — | Email notifications via Mailpit |

## Kafka Event Flow

Two topics drive the async order→payment saga:

1. **`order.created`** (3 partitions, RF=1)
   - **Producer:** order-service (on `POST /orders` checkout)
   - **Consumers:** payment-service (saga participant), notification-service (email)
   - **Key:** `orderId` (string)
   - **Payload:** order snapshot with items, prices, userId

2. **`payment.completed`** (3 partitions, RF=1)
   - **Producer:** payment-service (after mock processing)
   - **Consumers:** order-service (status transition), notification-service (email)
   - **Key:** `orderId` (string)
   - **Payload:** `{ orderId, outcome: "APPROVED"|"DECLINED", ... }`

### State Machine

```
POST /orders → PENDING_PAYMENT
  ↓ payment.completed (APPROVED)  → PAID
  ↓ payment.completed (DECLINED)  → PAYMENT_FAILED
```

Terminal states (`PAID`, `PAYMENT_FAILED`) are idempotent — redelivery of `payment.completed` is safe.

## Authentication Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant FE as Next.js Frontend
    participant GW as API Gateway
    participant AUTH as auth-service

    B->>FE: POST /api/auth/login (email, password)
    FE->>AUTH: POST /auth/login
    AUTH-->>FE: { token: "jwt..." }
    FE-->>B: Set-Cookie: token=jwt (httpOnly, sameSite)

    B->>FE: GET /api/gateway/catalog/products
    Note over FE: Middleware reads cookie,<br/>attaches Authorization header
    FE->>GW: GET /catalog/products + Bearer jwt
    GW->>GW: Verify JWT (HS256, shared secret)
    GW->>CAT: GET /catalog/products
    CAT-->>GW: products[]
    GW-->>FE: products[]
    FE-->>B: Rendered product list
```

## Infrastructure

| Component | Image | Purpose |
|-----------|-------|---------|
| PostgreSQL 18 | `postgres:18` | users + orders databases |
| MongoDB 8.0 | `mongo:8.0` | products collection |
| Redis 8 | `redis:8-alpine` | carts, rate limiting, payment dedup |
| Apache Kafka 4.2.1 | `apache/kafka:4.2.1` | Event bus (KRaft, no ZooKeeper) |
| Mailpit | `axllent/mailpit` | Mock SMTP + web UI |
| Kafka UI | `provectuslabs/kafka-ui` | Topic/consumer inspection |

## Key Design Decisions

1. **Polyglot by design** — Three language runtimes prove the interop contracts work across technology boundaries, which is the core learning goal.
2. **Contracts-first** — OpenAPI specs and Kafka topic schemas (Phase 1) exist before any service code, serving as the sole drift guard.
3. **No ZooKeeper** — Kafka 4.x is KRaft-only; the ZK container is dead weight.
4. **Motor → PyMongo AsyncMongoClient** — Motor is deprecated (EOL 2026-05-14); native `pymongo.AsyncMongoClient` (≥4.9) is the official replacement.
5. **MailHog → Mailpit** — MailHog is unmaintained since 2020; Mailpit is drop-in compatible with REST API for assertions.
6. **Integer-cents money** — All prices are `priceCents: int` to avoid floating-point drift across three languages.
7. **httpOnly cookie JWT** — The frontend never exposes the JWT to client-side JavaScript; the Next.js server-side proxy attaches it.
