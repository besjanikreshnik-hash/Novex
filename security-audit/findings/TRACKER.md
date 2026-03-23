# NovEx Security Findings Tracker

## Schema

Each finding follows this structure:

| Field | Description |
|-------|-------------|
| **ID** | `NVX-{sequential}` |
| **Title** | Short description |
| **Severity** | Critical / High / Medium / Low / Info |
| **Status** | Open / In Progress / Fixed / Verified / Accepted Risk / Won't Fix |
| **Affected Component** | Module/file path |
| **Exploit Scenario** | How an attacker exploits this |
| **Remediation Plan** | What to do to fix it |
| **Owner** | Person or team responsible |
| **Target Date** | When fix should be complete |
| **Verification** | How the fix is verified (test, manual check, re-audit) |
| **Evidence** | Reference to evidence file or PoC |

---

## Findings

### NVX-001: JWT default secret is hardcoded fallback

| Field | Value |
|-------|-------|
| Severity | **Critical** |
| Status | Open |
| Component | `src/config/configuration.ts`, `src/modules/auth/auth.module.ts` |
| Exploit | If `JWT_SECRET` env var is not set, the secret defaults to `change-me`. Any attacker can forge valid JWTs. |
| Remediation | 1. Remove default value — fail fast on startup if unset. 2. Add startup validation that rejects secrets shorter than 32 characters. 3. Generate a cryptographically random secret in production. |
| Owner | Backend lead |
| Target Date | Before pilot |
| Verification | Unit test: app fails to start with missing/weak JWT_SECRET. Manual: verify production deployment has unique secret. |
| Evidence | `configuration.ts` line: `secret: process.env.JWT_SECRET ?? 'change-me'` |

---

### NVX-002: Database SSL disables certificate validation

| Field | Value |
|-------|-------|
| Severity | **High** |
| Status | Open |
| Component | `src/app.module.ts` TypeORM config |
| Exploit | `rejectUnauthorized: false` allows MITM on database connections. Attacker on the network can intercept all SQL traffic. |
| Remediation | 1. In production, set `rejectUnauthorized: true`. 2. Configure the RDS CA certificate bundle. 3. Add `ca` option pointing to the AWS RDS CA cert. |
| Owner | Infrastructure |
| Target Date | Before pilot |
| Verification | Connection test with SSL strict mode. Verify with `openssl s_client` that the cert chain is valid. |
| Evidence | `app.module.ts`: `ssl: { rejectUnauthorized: false }` |

---

### NVX-003: /metrics endpoint has no authentication

| Field | Value |
|-------|-------|
| Severity | **Medium** |
| Status | Open |
| Component | `src/common/metrics/metrics.controller.ts` |
| Exploit | Anyone can access `/metrics` and see internal system state (request counts, error rates, node.js heap stats). Could aid reconnaissance. |
| Remediation | 1. Add IP allowlist (Prometheus scraper IPs only). 2. Or add a simple bearer token check. 3. Or restrict at load balancer/WAF level. |
| Owner | Infrastructure |
| Target Date | Before pilot |
| Verification | Unauthenticated request to /metrics returns 403. |
| Evidence | `metrics.controller.ts`: no guards on `GET /metrics` |

---

### NVX-004: Access tokens not server-side revocable

| Field | Value |
|-------|-------|
| Severity | **Medium** |
| Status | Open |
| Component | `src/modules/auth/` |
| Exploit | After logout or account freeze, the access token remains valid for up to 15 minutes. An attacker with a stolen token has a 15-minute window. |
| Remediation | Option A (recommended): Add Redis-backed token blacklist checked on every request. Option B (accepted risk): Document the 15-minute window as accepted and reduce access token TTL to 5 minutes. |
| Owner | Backend lead |
| Target Date | Before pilot (if Option A) or document acceptance |
| Verification | Test: freeze account → attempt API call with valid token → should 401. |
| Evidence | JWT strategy validates token signature and user existence but not blacklist. |

---

### NVX-005: Token storage in localStorage (XSS risk)

| Field | Value |
|-------|-------|
| Severity | **Medium** |
| Status | Open |
| Component | `packages/web/src/lib/api.ts` |
| Exploit | If an XSS vulnerability exists in the web app, attacker JavaScript can read tokens from localStorage. |
| Remediation | Option A: Move tokens to httpOnly, Secure, SameSite=Strict cookies. Option B (accepted risk): Keep localStorage but ensure strong CSP headers and XSS-free codebase. |
| Owner | Frontend lead |
| Target Date | Before pilot (if Option A) or document acceptance |
| Verification | Verify no `document.cookie` or `localStorage` access from injected script possible under CSP. |
| Evidence | `api.ts`: `localStorage.setItem('novex_access_token', access)` |

---

### NVX-006: No 2FA enforcement on withdrawals

| Field | Value |
|-------|-------|
| Severity | **Medium** |
| Status | Open |
| Component | `src/modules/funding/funding.controller.ts` |
| Exploit | Stolen session token can be used to withdraw funds without additional verification. |
| Remediation | 1. Require TOTP code on withdrawal requests. 2. Add `twoFactorCode` field to withdrawal DTO. 3. Verify code against user's TOTP secret before processing. |
| Owner | Backend lead |
| Target Date | Before pilot |
| Verification | Withdrawal without 2FA code → 403. Withdrawal with valid code → succeeds. |
| Evidence | No 2FA check in `requestWithdrawal()` |

---

### NVX-007: No IP allowlist on admin endpoints

| Field | Value |
|-------|-------|
| Severity | **Medium** |
| Status | Open |
| Component | All `/admin/*` routes |
| Exploit | Compromised admin credentials from any IP can access admin functions. |
| Remediation | 1. Add WAF rule restricting `/admin/*` to office/VPN IPs. 2. Or add an IP allowlist guard at application level. |
| Owner | Infrastructure |
| Target Date | Before pilot |
| Verification | Request from non-allowlisted IP → 403. |
| Evidence | Admin routes have RBAC guards but no IP restriction. |

---

### NVX-008: Kafka connection has no authentication

| Field | Value |
|-------|-------|
| Severity | **Low** |
| Status | Open |
| Component | `src/modules/audit/audit.service.ts` |
| Exploit | If Kafka is network-accessible, an attacker could inject false audit events. |
| Remediation | Use MSK IAM authentication in production (AWS managed Kafka). |
| Owner | Infrastructure |
| Target Date | Before production (not required for pilot) |
| Verification | Verify MSK IAM auth is enabled in production config. |
| Evidence | `new Kafka({ ... })` with no SASL configuration. |

---

### NVX-009: CORS allows all origins in development

| Field | Value |
|-------|-------|
| Severity | **Low** |
| Status | Open |
| Component | `src/main.ts` |
| Exploit | In development mode, any origin can make API requests. If deployed without NODE_ENV=production, cross-origin attacks possible. |
| Remediation | Verify production deployment sets NODE_ENV=production. Add startup check. |
| Owner | DevOps |
| Target Date | Before pilot |
| Verification | Production CORS header only includes `https://novex.io`. |
| Evidence | `main.ts`: `origin: config.get('nodeEnv') === 'production' ? ['https://novex.io'] : true` |

---

### NVX-010: WebSocket public channels have no auth check

| Field | Value |
|-------|-------|
| Severity | **Info** |
| Status | Accepted Risk |
| Component | `src/modules/market/market.gateway.ts` |
| Exploit | Anyone can subscribe to ticker, trades, orderbook without authentication. |
| Remediation | N/A — public market data is public by design (same as all major exchanges). |
| Owner | — |
| Target Date | — |
| Verification | N/A |
| Evidence | Design decision documented in `SECURITY-review-package.md` Section 5. |

---

*Add new findings below this line following the same schema.*
