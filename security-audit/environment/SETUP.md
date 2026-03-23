# Audit Environment Setup

## Prerequisites

- Docker Desktop
- Node.js 20+
- npm
- PostgreSQL client tools (psql, pg_dump)

## Quick Start (10 minutes)

### 1. Start infrastructure

```bash
cd infra/docker
docker compose up postgres redis kafka -d
```

### 2. Start backend

```bash
cd packages/backend
cp .env.example .env
# Verify .env contains:
#   DATABASE_PASSWORD=novex_dev
#   DATABASE_NAME=novex
#   JWT_SECRET=change-me  (default for local testing)
npm install
npm run start:dev
```

Backend: `http://localhost:3000`
Swagger: `http://localhost:3000/api/v1`
Metrics: `http://localhost:3000/metrics`

### 3. Seed test data

```bash
cd packages/backend
npm run seed
```

Creates:
- **admin@novex.io** (role: admin, password: `NovEx_Test_2024!`)
- **alice@test.novex.io** (role: user, KYC: verified, 100K USDT + 2 BTC)
- **bob@test.novex.io** (role: user, KYC: verified, 50K USDT + 1 BTC)
- Trading pairs: BTC_USDT, ETH_USDT, SOL_USDT

### 4. Start web app (optional — for browser testing)

```bash
cd packages/web
cp .env.example .env
npm install
npm run dev
```

Web: `http://localhost:3001`

### 5. Verify

```bash
# Health check
curl http://localhost:3000/api/v1/market/pairs

# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@novex.io","password":"NovEx_Test_2024!"}'

# Should return { user, tokens }
```

## Test Account Roles

To test RBAC, create users with different roles directly in the database:

```sql
-- Create an OPS user
INSERT INTO users (email, password_hash, role, kyc_status, is_active)
VALUES ('ops@novex.io', '$2b$12$...hash...', 'ops', 'verified', true);

-- Create a COMPLIANCE user
INSERT INTO users (email, password_hash, role, kyc_status, is_active)
VALUES ('compliance@novex.io', '$2b$12$...hash...', 'compliance', 'verified', true);
```

Or use the seeded admin account and modify its role as needed.

## Running Test Suites

```bash
cd packages/backend

npm run test:engine          # Matching engine
npm run test:engine:integration  # Settlement
npm run test:market          # Market orders
npm run test:concurrency     # Idempotency + races
npm run test:funding         # Deposit/withdrawal
npm run test:admin-controls  # RBAC + maker-checker
npm run test:custody         # Custody pipeline
npm run test:governance      # Governance maker-checker
npm run test:recon           # Reconciliation invariants
npm run test:providers       # KYC + blockchain mocks
npm run test:load            # Load + failure modes
```

## Resetting State

```bash
cd packages/backend
npm run db:reset   # Drop all → migrate → seed
```
