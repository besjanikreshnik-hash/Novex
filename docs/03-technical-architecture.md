# NovEx — Technical Architecture

## 1. System Overview

```
                                    ┌─────────────────────┐
                                    │   CDN (CloudFront)   │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
              ┌─────▼─────┐            ┌───────▼───────┐          ┌──────▼──────┐
              │  Web App   │            │  Mobile Apps   │          │  Extension   │
              │  (Next.js) │            │ (React Native) │          │  (Chrome)    │
              └─────┬─────┘            └───────┬───────┘          └──────┬──────┘
                    │                          │                          │
                    └──────────────────────────┼──────────────────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   API Gateway        │
                                    │   (Kong / AWS ALB)   │
                                    │   Rate Limit, Auth   │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────┬────────────┼────────────┬──────────────┐
                    │              │            │            │              │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌─────▼─────┐
              │   Auth     │ │  Account   │ │ Trade │ │  Market   │ │  Wallet   │
              │  Service   │ │  Service   │ │Engine │ │  Data Svc │ │  Service  │
              └─────┬─────┘ └─────┬─────┘ └───┬───┘ └─────┬─────┘ └─────┬─────┘
                    │              │            │            │              │
                    └──────────────┴────────────┼────────────┴──────────────┘
                                               │
                              ┌─────────────────┼─────────────────┐
                              │                 │                 │
                       ┌──────▼──────┐  ┌───────▼───────┐ ┌──────▼──────┐
                       │ PostgreSQL  │  │    Redis       │ │   Kafka     │
                       │ (Primary +  │  │  (Cache +      │ │  (Events +  │
                       │  Replicas)  │  │   Sessions)    │ │   Streams)  │
                       └─────────────┘  └───────────────┘ └─────────────┘
```

## 2. Service Architecture (Modular Monolith → Microservices)

**Strategy:** Start as a modular monolith in NestJS with clear module boundaries. Each module can be extracted into a standalone microservice when scaling demands it.

### Services

| Service         | Responsibility                                | Protocol        |
|-----------------|-----------------------------------------------|-----------------|
| API Gateway     | Routing, rate limiting, auth token validation | HTTP/WS         |
| Auth Service    | Registration, login, 2FA, passkeys, sessions  | REST            |
| Account Service | Profile, KYC, preferences, API keys           | REST            |
| Trade Engine    | Order matching, order book management          | gRPC + Events   |
| Trade API       | Order placement, cancellation, trade history   | REST + WS       |
| Market Data     | Prices, candles, tickers, depth               | REST + WS       |
| Wallet Service  | Balances, deposits, withdrawals, addresses     | REST + Events   |
| Notification Svc| Email, push, in-app, alerts                   | Events + REST   |
| Fee Service     | Fee calculation, tier management               | REST            |
| Referral Service| Links, tracking, commission                    | REST + Events   |
| Admin Service   | Backoffice operations, reports                 | REST            |
| Audit Service   | Immutable event logging                        | Events          |

### Communication Patterns

```
Synchronous (REST/gRPC):
  Client → API Gateway → Service → Database
  Service → Service (internal REST, same cluster)

Asynchronous (Kafka):
  Trade Engine → trade.executed → [Wallet, Notification, Market Data, Audit]
  Wallet Service → deposit.confirmed → [Notification, Audit]
  Auth Service → user.registered → [Account, Notification, Referral]
```

## 3. Matching Engine Design

The matching engine is the most critical component. It runs in-process for Phase 0 and can be extracted to a dedicated high-performance service later.

### Architecture

```
Order Placement Flow:
  1. Trade API receives order → validates → checks balance
  2. Wallet Service locks funds (available → locked)
  3. Order sent to Matching Engine
  4. Engine matches against order book (price-time priority)
  5. If match: Emit trade.executed event
     If no match: Insert into order book
  6. Kafka consumers process settlement:
     - Wallet Service: credit/debit balances
     - Market Data: update candles, ticker
     - Notification: alert user
     - Audit: log trade
```

### Order Book Structure (In-Memory)

```typescript
interface OrderBook {
  pair: string;           // e.g., "BTC_USDT"
  bids: SortedMap<Price, Queue<Order>>;  // Sorted descending (highest first)
  asks: SortedMap<Price, Queue<Order>>;  // Sorted ascending (lowest first)
}

interface Order {
  id: string;
  userId: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price: Decimal;         // Using decimal for financial precision
  quantity: Decimal;
  filledQuantity: Decimal;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  timestamp: bigint;      // Nanosecond precision for ordering
}
```

### Performance Targets

| Metric                  | Target           |
|-------------------------|------------------|
| Order processing        | < 1ms per order  |
| Order book depth        | 10,000+ levels   |
| Throughput              | 10,000 orders/s  |
| Trade event publishing  | < 5ms latency    |

## 4. Data Architecture

### PostgreSQL Schema Strategy

- **Partitioning:** Trade and order tables partitioned by month
- **Sharding Plan:** User-based sharding ready (Phase 3+)
- **Read Replicas:** 2 replicas for read-heavy queries (market data, history)
- **Connection Pooling:** PgBouncer in transaction mode

### Redis Usage

| Use Case          | Data Structure | TTL        |
|-------------------|----------------|------------|
| Session tokens    | String         | 24h        |
| Rate limiting     | Sorted Set     | 1min       |
| Price cache       | Hash           | 5s         |
| Order book cache  | Sorted Set     | Real-time  |
| User balance cache| Hash           | 30s        |
| Pub/Sub channels  | Pub/Sub        | N/A        |
| Distributed locks | String + NX    | 30s        |

### Kafka Topics

| Topic                  | Partitions | Consumers                          |
|------------------------|------------|------------------------------------|
| order.placed           | 12         | Trade Engine                       |
| order.cancelled        | 6          | Trade Engine, Wallet               |
| trade.executed         | 12         | Wallet, Notification, Market, Audit|
| deposit.detected       | 6          | Wallet, Notification               |
| deposit.confirmed      | 6          | Wallet, Notification, Audit        |
| withdrawal.requested   | 6          | Wallet, Notification, Admin        |
| withdrawal.processed   | 6          | Wallet, Notification, Audit        |
| user.registered        | 6          | Account, Notification, Referral    |
| user.kyc.updated       | 6          | Account, Notification, Audit       |
| price.updated          | 24         | Market Data, Alerts                |
| audit.event            | 12         | Audit Service                      |

## 5. API Architecture

### Public REST API

```
Base: https://api.novex.io/v1

Auth:
  POST   /auth/register
  POST   /auth/login
  POST   /auth/2fa/enable
  POST   /auth/2fa/verify
  POST   /auth/passkey/register
  POST   /auth/passkey/verify
  POST   /auth/refresh
  DELETE /auth/sessions/{id}

Account:
  GET    /account/profile
  PATCH  /account/profile
  POST   /account/kyc/submit
  GET    /account/kyc/status
  GET    /account/api-keys
  POST   /account/api-keys
  DELETE /account/api-keys/{id}

Wallet:
  GET    /wallet/balances
  GET    /wallet/deposits
  GET    /wallet/deposits/{id}
  POST   /wallet/deposit-address
  GET    /wallet/withdrawals
  POST   /wallet/withdraw
  GET    /wallet/withdrawals/{id}

Trading:
  POST   /trading/orders
  GET    /trading/orders
  GET    /trading/orders/{id}
  DELETE /trading/orders/{id}
  GET    /trading/trades
  GET    /trading/fees

Market:
  GET    /market/pairs
  GET    /market/ticker
  GET    /market/ticker/{pair}
  GET    /market/orderbook/{pair}
  GET    /market/trades/{pair}
  GET    /market/candles/{pair}
```

### WebSocket API

```
Endpoint: wss://ws.novex.io/v1/stream

Public Channels (no auth):
  ticker@{pair}        — Real-time price updates
  orderbook@{pair}     — Order book deltas
  trades@{pair}        — Recent trades stream
  candles@{pair}_{tf}  — Candlestick updates

Private Channels (auth required):
  orders               — User order updates
  trades               — User trade executions
  balances             — Balance changes
  notifications        — Alerts and system messages
```

### API Authentication

```
Public endpoints: No auth
Private endpoints: Two methods

Method 1 — Session Token (web/mobile):
  Authorization: Bearer <jwt_token>

Method 2 — API Key + HMAC (programmatic):
  X-NVX-APIKEY: <api_key>
  X-NVX-TIMESTAMP: <unix_ms>
  X-NVX-SIGNATURE: HMAC-SHA256(secret, timestamp + method + path + body)
```

## 6. Infrastructure Architecture

### AWS Services

| Service           | Usage                                    |
|-------------------|------------------------------------------|
| EKS               | Kubernetes cluster for all services      |
| RDS (PostgreSQL)  | Primary database + read replicas         |
| ElastiCache       | Redis cluster                            |
| MSK               | Managed Kafka                            |
| S3                | File storage (KYC docs, exports)         |
| CloudFront        | CDN for web/mobile assets                |
| Route 53          | DNS management                           |
| ACM               | TLS certificates                         |
| WAF               | Web application firewall                 |
| KMS               | Encryption key management                |
| SES               | Transactional email                      |
| CloudWatch        | AWS-level monitoring                     |
| ECR               | Container registry                       |

### Kubernetes Architecture

```
Namespaces:
  novex-prod          — Production services
  novex-staging       — Staging environment
  novex-monitoring    — Prometheus, Grafana, Loki
  novex-ingress       — Nginx Ingress Controller

Per-Service Deployment:
  - Deployment (2+ replicas for critical services)
  - Service (ClusterIP)
  - HPA (Horizontal Pod Autoscaler)
  - PDB (Pod Disruption Budget)
  - NetworkPolicy (service-to-service restrictions)

Ingress:
  api.novex.io     → API Gateway pods
  ws.novex.io      → WebSocket Gateway pods
  app.novex.io     → Web App pods
  admin.novex.io   → Admin Panel pods (IP-restricted)
```

### Environment Strategy

| Environment | Purpose              | Data          | Access           |
|-------------|----------------------|---------------|------------------|
| Local       | Development          | Seed data     | Developer        |
| Staging     | Integration testing  | Anonymized    | Team             |
| Production  | Live platform        | Real          | Restricted       |

## 7. Observability Stack

```
Metrics:   OpenTelemetry → Prometheus → Grafana
Logs:      Structured JSON → Loki → Grafana
Traces:    OpenTelemetry → Tempo → Grafana
Errors:    Sentry (all services + clients)
Analytics: PostHog (product analytics)
Uptime:    External ping monitoring (Betterstack/Checkly)

Key Dashboards:
  - System Health (CPU, memory, pod status)
  - Trading Volume (orders/s, trades/s, latency)
  - User Funnel (signup → KYC → deposit → trade)
  - Error Rates (by service, by endpoint)
  - Security (failed logins, rate limit hits, suspicious activity)
```

## 8. Technology Stack Summary

| Layer          | Technology                              |
|----------------|----------------------------------------|
| Web Frontend   | Next.js 14+, TypeScript, TailwindCSS   |
| Mobile         | React Native (Expo), TypeScript         |
| Extension      | Chrome MV3, React, TypeScript           |
| Admin Panel    | Next.js, TypeScript, TailwindCSS        |
| API Gateway    | NestJS (or Kong for dedicated gateway)  |
| Backend        | NestJS, TypeScript, Node.js 20+        |
| Matching Engine| TypeScript (→ Rust/Go for Phase 3)     |
| Database       | PostgreSQL 16                           |
| Cache          | Redis 7 (Cluster mode)                  |
| Message Queue  | Apache Kafka (AWS MSK)                  |
| Object Storage | AWS S3                                  |
| Container      | Docker                                  |
| Orchestration  | Kubernetes (AWS EKS)                    |
| CI/CD          | GitHub Actions                          |
| IaC            | Terraform                               |
| Monitoring     | Prometheus + Grafana + Loki + Tempo     |
| Error Tracking | Sentry                                  |
| Analytics      | PostHog                                 |
| CDN            | CloudFront                              |
| DNS            | Route 53                                |
| Email          | AWS SES                                 |
