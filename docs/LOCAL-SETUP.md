# NovEx -- Local Development Setup

Complete guide to running the NovEx platform locally for development and demo purposes.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Docker Desktop | Latest | `docker --version` |
| Git | Latest | `git --version` |

**Optional:**
- Expo CLI for mobile development: `npm install -g expo-cli`
- Expo Go app on iOS/Android for mobile testing

---

## 1. Clone and Install

```bash
git clone https://github.com/your-org/novex.git
cd novex
```

Install dependencies for each package:

```bash
cd packages/backend && npm install && cd ../..
cd packages/web && npm install && cd ../..
cd packages/admin && npm install && cd ../..
```

---

## 2. Start Infrastructure (Docker)

Start PostgreSQL, Redis, and Kafka:

```bash
cd infra/docker
docker compose up postgres redis kafka zookeeper -d
```

Wait for services to be healthy (~10 seconds):

```bash
docker compose ps
```

All services should show "healthy" or "running" status.

**Service ports:**
| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5433 (host) -> 5432 (container) | User: `novex`, Pass: `novex_dev`, DB: `novex` |
| Redis | 6379 | No auth |
| Kafka | 9092 | Auto-create topics enabled |

### Optional: Dev Tools

Start Kafka UI and MailHog for debugging:

```bash
docker compose --profile dev-tools up kafka-ui mailhog -d
```

- Kafka UI: `http://localhost:8080`
- MailHog (email testing): `http://localhost:8025`

---

## 3. Start Backend

```bash
cd packages/backend
cp .env.example .env
```

Edit `.env` and set:

```env
DATABASE_URL=postgresql://novex:novex_dev@localhost:5433/novex
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGINS=http://localhost:3001,http://localhost:3002
PORT=3000
```

Start in development mode:

```bash
npm run start:dev
```

Backend starts at `http://localhost:3000`. Swagger docs at `http://localhost:3000/api/v1`.

On first start with `synchronize: true`, TypeORM creates all tables automatically.

---

## 4. Seed the Database

In a new terminal:

```bash
cd packages/backend
npm run seed
```

This creates:
- **3 trading pairs:** BTC_USDT, ETH_USDT, SOL_USDT (0.1% maker / 0.2% taker fees)
- **3 test users** (password for all: `NovEx_Test_2024!`):
  - `admin@novex.io` -- Admin user
  - `alice@test.novex.io` -- 100,000 USDT + 2 BTC + 20 ETH + 500 SOL
  - `bob@test.novex.io` -- 50,000 USDT + 1 BTC + 10 ETH + 200 SOL

Verify the seed worked:

```bash
curl http://localhost:3000/api/v1/market/pairs
```

You should see the three trading pairs returned.

---

## 5. Start Web App

```bash
cd packages/web
cp .env.example .env
```

Edit `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

Start in development mode:

```bash
npm run dev
```

Web app starts at `http://localhost:3001`.

---

## 6. Start Admin Panel

```bash
cd packages/admin
cp .env.example .env
```

Edit `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Start in development mode:

```bash
npm run dev -- -p 3002
```

Admin panel starts at `http://localhost:3002`.

---

## 7. Start Mobile App (Optional)

```bash
cd packages/mobile
npm install
npx expo start
```

Scan the QR code with Expo Go on your device, or press `a` for Android emulator / `i` for iOS simulator.

---

## Full Stack via Docker Compose

To run everything (backend, web, admin, and infrastructure) in Docker:

```bash
cd infra/docker
docker compose up -d
```

Then seed the database:

```bash
docker compose exec backend npm run seed
```

**Service URLs:**
| Service | URL |
|---------|-----|
| Web App | http://localhost:3001 |
| Admin Panel | http://localhost:3002 |
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/v1 |

---

## Common Issues and Fixes

### Backend won't start

**Symptom:** Connection refused or database errors on startup.

**Fix:** Verify PostgreSQL is running and accessible:
```bash
docker ps | grep postgres
```
Ensure `.env` values match the docker compose config. Note the host port is `5433`, not `5432`.

### Login returns 401 Unauthorized

**Symptom:** Correct credentials but authentication fails.

**Fix:** The seed has not been run. Execute:
```bash
cd packages/backend
npm run seed
```

### No trading pairs shown on Markets page

**Symptom:** Markets page is empty or shows "no pairs."

**Fix:** Verify pairs exist:
```bash
curl http://localhost:3000/api/v1/market/pairs
```
If empty, re-run the seed command.

### Order placement fails with "not found or inactive"

**Symptom:** Placing an order returns a pair-not-found error.

**Fix:** The pair symbol must match exactly (e.g., `BTC_USDT` not `BTC/USDT`). Check the pair selector on the trade page.

### Balances don't update after a trade

**Symptom:** Wallet still shows old balances after a completed trade.

**Fix:** The web app polls every 5 seconds. Refresh the page manually or wait a few seconds.

### Port already in use

**Symptom:** `EADDRINUSE` error when starting a service.

**Fix:** Kill the process using the port:
```bash
# Find process on port 3000 (Linux/Mac)
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Docker containers not starting

**Symptom:** `docker compose up` fails or containers crash.

**Fix:**
1. Ensure Docker Desktop is running
2. Check for port conflicts: `docker ps -a`
3. Reset volumes if data is corrupted:
   ```bash
   cd infra/docker
   docker compose down -v
   docker compose up -d
   ```
   Note: This deletes all local data. Re-run the seed after.

### Kafka connection errors

**Symptom:** Backend logs show Kafka connection timeouts.

**Fix:** Kafka takes 10-15 seconds to fully start. Restart the backend after Kafka is ready:
```bash
docker compose ps  # ensure kafka shows "running"
cd packages/backend
npm run start:dev
```

### Web app shows blank page

**Symptom:** `http://localhost:3001` loads but shows nothing.

**Fix:**
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_API_URL` is set correctly in `.env`
3. Ensure the backend is running and accessible: `curl http://localhost:3000/api/v1/market/pairs`

### TypeScript compilation errors

**Symptom:** `tsc --noEmit` or build fails with type errors.

**Fix:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache (web/admin)
rm -rf .next
```
