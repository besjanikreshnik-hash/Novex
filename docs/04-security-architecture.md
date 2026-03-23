# NovEx — Security Architecture

## 1. Security Principles

1. **Defense in Depth** — Multiple layers of security controls at every boundary
2. **Zero Trust** — Verify every request, trust no network boundary
3. **Least Privilege** — Minimum access required for any role or service
4. **Secure by Default** — All features ship with security enabled, not optional
5. **Auditability** — Every state-changing action is logged immutably

## 2. Authentication Architecture

### 2.1 Registration Flow

```
Client → POST /auth/register
  1. Validate email format, password strength (zxcvbn score ≥ 3)
  2. Check email not already registered
  3. Hash password: Argon2id (memory=64MB, iterations=3, parallelism=4)
  4. Generate unique user ID (UUIDv7 for time-ordering)
  5. Store user record (status: pending_verification)
  6. Generate email verification token (cryptographic random, 32 bytes)
  7. Send verification email (token expires in 24h)
  8. Capture device fingerprint for trust scoring
  9. Emit user.registered event
```

### 2.2 Login Flow

```
Client → POST /auth/login
  1. Lookup user by email
  2. Verify password against Argon2id hash
  3. If 2FA enabled:
     a. Return challenge token
     b. Client submits 2FA code → POST /auth/2fa/verify
     c. Verify TOTP code (allow ±1 window drift)
  4. Evaluate device trust:
     a. Known device + known IP → Low risk
     b. Known device + new IP → Medium risk (notify user)
     c. New device → High risk (require email confirmation)
  5. Generate session:
     a. Access token: JWT (RS256, 15min expiry)
     b. Refresh token: Opaque (stored in Redis, 7-day expiry)
  6. Log login event (IP, device, location, risk score)
  7. Return tokens + require_2fa_setup flag if not enabled
```

### 2.3 Passkey (WebAuthn) Flow

```
Registration:
  1. Server generates challenge (random 32 bytes)
  2. Client creates credential via navigator.credentials.create()
  3. Server verifies attestation, stores public key + credential ID
  4. Passkey becomes primary or secondary auth method

Authentication:
  1. Server generates challenge
  2. Client signs challenge via navigator.credentials.get()
  3. Server verifies signature against stored public key
  4. Session issued (skips password + 2FA if passkey is sufficient)
```

### 2.4 Session Management

```
Token Structure:
  Access Token (JWT):
    - sub: user_id
    - iat, exp: issued/expiry timestamps
    - sid: session_id (for revocation)
    - dev: device_hash
    - tier: kyc_tier
    - Signed with RS256 (rotated monthly)

  Refresh Token:
    - Stored in Redis: refresh:{token_hash} → {user_id, session_id, device_hash}
    - HTTP-only, Secure, SameSite=Strict cookie (web)
    - Secure storage (mobile)

Session Rules:
  - Max 5 concurrent sessions per user
  - New session on new device triggers notification
  - Refresh token rotation on every use (old token invalidated)
  - All sessions revocable from security settings
  - Admin can force-revoke all sessions for a user
```

## 3. API Security

### 3.1 Rate Limiting

```
Layers:
  1. WAF Level (AWS WAF):
     - 1000 req/min per IP (global)
     - Geographic blocking (sanctioned countries)

  2. API Gateway Level:
     - Public endpoints: 60 req/min per IP
     - Authenticated: 300 req/min per user
     - Trading endpoints: 30 req/s per user
     - WebSocket: 100 messages/min per connection

  3. Service Level:
     - Login attempts: 5/min per email, 20/min per IP
     - Registration: 3/hour per IP
     - Withdrawal requests: 5/hour per user
     - KYC submissions: 3/day per user

Implementation:
  Redis SORTED SET sliding window algorithm
  Key: ratelimit:{scope}:{identifier}:{window}
  Score: timestamp, Member: request_id
```

### 3.2 API Key Security (HMAC Signing)

```
Request Signing:
  1. Client constructs signing string:
     payload = timestamp + "\n" + method + "\n" + path + "\n" + body_hash

  2. Generate signature:
     signature = HMAC-SHA256(api_secret, payload)

  3. Server validates:
     a. Timestamp within ±30 seconds of server time
     b. Recompute HMAC and compare (constant-time)
     c. Check API key is active and has required permissions
     d. Check IP allowlist if configured

API Key Permissions (Scopes):
  - read:account    — View profile, balances
  - read:market     — Market data access
  - trade:spot      — Place/cancel spot orders
  - withdraw        — Create withdrawal requests (requires IP allowlist)
```

### 3.3 Input Validation

```
All Inputs:
  - Strict JSON schema validation (Zod/class-validator)
  - Max request body size: 1MB
  - No SQL in any user input (parameterized queries only)
  - HTML sanitization for all text fields
  - Decimal precision validation for financial amounts
  - UUID format validation for all ID parameters

Financial Amounts:
  - Server-side decimal library (decimal.js / pg NUMERIC)
  - Never use floating point for money
  - Max precision: 18 decimal places
  - Validate: amount > 0, amount ≤ balance, amount ≤ max_withdrawal
```

## 4. Wallet Security

### 4.1 Hot/Cold Wallet Architecture

```
                    ┌──────────────┐
                    │  Cold Wallet  │
                    │  (95% funds)  │
                    │  Air-gapped   │
                    │  Multi-sig    │
                    └──────┬───────┘
                           │ Manual transfer
                           │ (threshold trigger)
                    ┌──────▼───────┐
                    │  Warm Wallet  │
                    │  (Buffer)     │
                    │  HSM-signed   │
                    └──────┬───────┘
                           │ Automated
                    ┌──────▼───────┐
                    │  Hot Wallet   │
                    │  (5% funds)   │
                    │  Auto-withdraw│
                    └──────────────┘

Rules:
  - Hot wallet holds max 5% of total assets per currency
  - Warm-to-hot replenishment triggered when hot wallet < 2%
  - Cold-to-warm requires manual multi-sig approval
  - All hot wallet private keys in HSM (AWS CloudHSM)
  - Withdrawal > $10,000 USD equiv → manual admin approval
  - Withdrawal to new address → 24h hold + email confirmation
```

### 4.2 Deposit Detection

```
For each supported blockchain:
  1. Run full/light node (or use provider: Alchemy, Infura placeholder)
  2. Monitor deposit addresses (derived per user per asset)
  3. Detect incoming transactions
  4. Require N confirmations before crediting:
     - BTC: 3 confirmations (~30 min)
     - ETH: 12 confirmations (~3 min)
     - USDT (ERC20): 12 confirmations
     - USDT (TRC20): 20 confirmations
  5. Credit user balance after confirmations
  6. Sweep deposits to hot wallet (batched, off-peak)
```

### 4.3 Withdrawal Processing

```
User Request → Validation → Risk Check → Processing

Validation:
  1. Verify 2FA code
  2. Check sufficient available balance
  3. Validate destination address format
  4. Check against withdrawal address whitelist

Risk Check:
  1. Is address in known-bad list? → Block
  2. Is amount > user's daily limit? → Block
  3. Is this a new address? → Apply 24h hold
  4. Does pattern match fraud signals? → Flag for review
  5. Aggregate daily withdrawal volume check

Processing:
  Low risk (< $10K, known address, verified user):
    → Auto-process from hot wallet
  Medium risk (new address, large amount):
    → Queue for manual review
  High risk (fraud signals):
    → Hold and alert compliance team
```

## 5. Data Security

### 5.1 Encryption

```
At Rest:
  - Database: AWS RDS encryption (AES-256)
  - S3: Server-side encryption (SSE-KMS)
  - Redis: Encryption at rest (ElastiCache)
  - Backups: Encrypted with separate KMS key

In Transit:
  - All external: TLS 1.3 (minimum TLS 1.2)
  - Internal service-to-service: mTLS via service mesh
  - Database connections: SSL required

Application-Level:
  - KYC documents: Encrypted with user-specific key before S3 storage
  - API secrets: Encrypted in database (AES-256-GCM, key in KMS)
  - Passwords: Argon2id hash (not encryption)
  - 2FA secrets: AES-256-GCM encrypted in database
```

### 5.2 PII Handling

```
Classification:
  High:   KYC documents, government IDs, SSN equivalents
  Medium: Full name, date of birth, address, phone number
  Low:    Email, display name, timezone

Storage Rules:
  High:   Encrypted at app level, access logged, auto-delete policy
  Medium: Database encryption sufficient, access logged
  Low:    Standard database security

Access Control:
  - Customer support: View name, email, KYC status only
  - Compliance: Full KYC access with audit trail
  - Engineering: No production PII access (anonymized in staging)
```

## 6. Infrastructure Security

### 6.1 Network Architecture

```
┌──────────────────────────────────────────┐
│                  VPC                      │
│  ┌──────────────────────────────────┐    │
│  │  Public Subnets                   │    │
│  │  - ALB / API Gateway              │    │
│  │  - NAT Gateway                    │    │
│  └──────────┬───────────────────────┘    │
│             │                             │
│  ┌──────────▼───────────────────────┐    │
│  │  Private Subnets (App)            │    │
│  │  - EKS Worker Nodes               │    │
│  │  - Service Pods                    │    │
│  └──────────┬───────────────────────┘    │
│             │                             │
│  ┌──────────▼───────────────────────┐    │
│  │  Private Subnets (Data)           │    │
│  │  - RDS (PostgreSQL)               │    │
│  │  - ElastiCache (Redis)            │    │
│  │  - MSK (Kafka)                    │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘

Rules:
  - No direct internet access for data tier
  - Security groups: Minimum required ports only
  - Network policies in K8s: Service-to-service allowlisting
  - Admin panel: IP-restricted access (office + VPN only)
```

### 6.2 Secret Management

```
AWS Secrets Manager / Parameter Store:
  - Database credentials
  - API keys for third-party services
  - JWT signing keys
  - Encryption keys

Kubernetes:
  - ExternalSecrets operator syncs from AWS Secrets Manager
  - No secrets in environment variables or config maps
  - No secrets in code or git (pre-commit hooks enforce)

Rotation:
  - Database passwords: 90-day rotation
  - JWT signing keys: 30-day rotation (overlap period)
  - API encryption keys: Annual rotation
  - Third-party API keys: Per vendor policy
```

## 7. Compliance & Monitoring

### 7.1 Audit Trail

```
Every state change produces an audit event:
{
  "event_id": "uuid",
  "timestamp": "iso8601",
  "actor": {
    "type": "user|admin|system",
    "id": "uuid",
    "ip": "1.2.3.4",
    "device_hash": "abc..."
  },
  "action": "withdrawal.requested",
  "resource": {
    "type": "withdrawal",
    "id": "uuid"
  },
  "details": {
    "amount": "1.5",
    "asset": "BTC",
    "destination": "bc1q..."
  },
  "risk_score": 0.15
}

Storage:
  - Write to Kafka topic: audit.event
  - Consumer writes to PostgreSQL (partitioned by month)
  - Immutable: No UPDATE or DELETE on audit tables
  - Retention: 7 years (regulatory requirement)
  - S3 archive for records older than 1 year
```

### 7.2 Threat Detection

```
Real-Time Monitoring:
  - Multiple failed logins from same IP → Temporary block
  - Login from new country → Email alert to user
  - Withdrawal to address seen in threat intelligence → Hold
  - Unusual trading pattern (wash trading signals) → Flag
  - API key used from non-allowlisted IP → Block + alert
  - Multiple accounts from same device → Flag for review

Automated Responses:
  - Block IP after 10 failed logins in 5 minutes
  - Freeze account after 5 failed 2FA attempts
  - Hold withdrawal if user changed password in last 24h
  - Require re-authentication after security setting changes
```

## 8. Security Testing

```
Continuous:
  - SAST: CodeQL / Semgrep in CI pipeline
  - SCA: Dependency scanning (Snyk / npm audit)
  - Container scanning: Trivy on all Docker images
  - Secret scanning: Gitleaks pre-commit hook

Periodic:
  - Penetration testing: Annual (third-party)
  - Smart contract audit: Before any on-chain deployment
  - Architecture review: Quarterly
  - Incident response drill: Bi-annual

Bug Bounty:
  - Launch after Phase 2
  - Critical: Up to $50,000
  - Scope: All production endpoints + mobile apps
```
