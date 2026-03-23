# NovEx — Custody Operations Runbook

## Provider Options

| Provider | Type | Key Storage | Signing | Broadcast | Best For |
|----------|------|-------------|---------|-----------|----------|
| Mock | In-memory | N/A | Instant | Instant | Development/testing |
| Fireblocks | MPC | Distributed MPC shards | MPC ceremony (5-60s) | Fireblocks handles | Production |
| KMS Signer | HSM | AWS KMS | KMS Sign API (< 1s) | NovEx broadcasts via RPC | Beta/hot wallet |

## Fireblocks Sandbox Setup

### 1. Create Fireblocks Sandbox Account

1. Go to https://www.fireblocks.com and request sandbox access
2. Once approved, access the sandbox console at https://sandbox.fireblocks.io
3. Create an API user: Settings → Users → API Users → Add
4. Download the RSA private key (PEM file) — **store securely**
5. Note the API Key ID

### 2. Configure Vault

1. In Fireblocks console: Accounts → Vault Accounts → Add
2. Note the vault account ID (use as `FIREBLOCKS_VAULT_ID`)
3. Add testnet assets to the vault: ETH_TEST5, BTC_TEST, etc.
4. Fund testnet assets via faucets

### 3. Set Environment Variables

```env
CUSTODY_PROVIDER_TYPE=fireblocks
FIREBLOCKS_API_KEY=your-api-user-id
FIREBLOCKS_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
FIREBLOCKS_BASE_URL=https://sandbox-api.fireblocks.io
FIREBLOCKS_VAULT_ID=0
```

### 4. Test

```bash
# Place a withdrawal request (via admin flow)
# The withdrawal executor will call Fireblocks sandbox API
# Check Fireblocks console for the transaction
```

## AWS KMS Signer Setup

### 1. Create KMS Key

```bash
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "NovEx hot wallet signing key (testnet)" \
  --tags TagKey=Environment,TagValue=sandbox

# Note the KeyId from the response
```

### 2. Configure IAM

The NovEx backend needs `kms:Sign` and `kms:GetPublicKey` permissions:

```json
{
  "Effect": "Allow",
  "Action": ["kms:Sign", "kms:GetPublicKey", "kms:DescribeKey"],
  "Resource": "arn:aws:kms:us-east-1:*:key/YOUR_KEY_ID"
}
```

### 3. Set Environment Variables

```env
CUSTODY_PROVIDER_TYPE=kms
KMS_KEY_ID=arn:aws:kms:us-east-1:123456789:key/abcd-1234
KMS_REGION=us-east-1
BROADCAST_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
```

## Resilience Features

### Timeouts

| Operation | Timeout | Rationale |
|-----------|---------|-----------|
| Create intent | 10-15s | API call to register |
| Request signature | 30-60s | MPC ceremony (Fireblocks) or HSM call (KMS) |
| Broadcast | 15-20s | Network submission |
| Status check | 10s | Polling query |

### Retries

- **Max retries:** 2 (3 total attempts)
- **Backoff:** Exponential with jitter: `min(1000 * 2^attempt, 8000) + random(0-500)ms`
- **Retryable errors:** Network timeouts, 5xx from provider, connection refused
- **Non-retryable:** 4xx (validation errors), signature rejection, policy block

### Idempotency Cache

Each provider instance maintains an in-memory cache mapping `intentId` → last known state. This prevents redundant API calls on retry:

- `createIntent()` → returns cached providerRef if already created
- `requestSignature()` → returns cached signedTx if already signed
- `broadcast()` → returns cached txHash if already broadcast
- `cancelIntent()` → short-circuits to false if txHash exists in cache

**Important:** The cache is per-process. In multi-instance deployments, the database-level idempotency (withdrawal status checks) provides the authoritative guard against double-broadcast.

## Failure Scenarios & Recovery

### Scenario 1: Signing Timeout

```
Symptom: Withdrawal stuck in PROCESSING, no txHash
Cause:   MPC ceremony took longer than timeout, or HSM unavailable

Steps:
  1. Check provider dashboard (Fireblocks console or CloudWatch KMS metrics)
  2. If signing completed on provider side:
     → Poll status: the executor will pick up the signed state on retry
  3. If signing failed on provider side:
     → Retry: call execute() again — idempotent, will re-attempt signing
  4. If provider is down:
     → Wait for recovery, then retry
     → If extended outage: reject the withdrawal and unlock funds
```

### Scenario 2: Broadcast Timeout (Most Dangerous)

```
Symptom: Signed tx exists, but broadcast result unknown
Risk:    Transaction may or may not be on the blockchain

Steps:
  1. Check provider dashboard for the transaction
  2. Search blockchain mempool/explorer for the signed tx hash
  3. If found on-chain:
     → Manually update withdrawal with txHash
     → Run settlement manually if needed
  4. If NOT found after 30 minutes:
     → Safe to retry broadcast (nonce prevents double-spend)
  5. If provider shows "broadcast" but no on-chain presence after 1 hour:
     → The signed tx may have expired (nonce reused)
     → Cancel intent and create new one
```

### Scenario 3: Fireblocks Policy Rejection

```
Symptom: Withdrawal rejected by Fireblocks policy engine
Cause:   Address on blocklist, amount exceeds policy limit, etc.

Steps:
  1. Check Fireblocks console → transaction → rejection reason
  2. Review the withdrawal in NovEx admin panel
  3. If legitimate: adjust Fireblocks policy, retry
  4. If suspicious: keep rejected, investigate user account
```

### Scenario 4: KMS Key Rotation

```
When:    Scheduled (annually) or on suspected compromise

Steps:
  1. Create new KMS key with same spec (ECC_SECG_P256K1)
  2. Derive new Ethereum address from new public key
  3. Transfer hot wallet balance from old address to new address
  4. Update KMS_KEY_ID in environment
  5. Restart backend
  6. Verify new address in deposit address generation
```

## Key Risk Assumptions

| Assumption | Risk If Wrong | Mitigation |
|-----------|--------------|------------|
| Provider API is available 99.9% | Withdrawals delayed | Timeout + retry + manual recovery path |
| Provider doesn't double-broadcast | Double-send loses funds | Nonce management, idempotency cache |
| KMS key is not compromised | Total hot wallet loss | Key rotation, balance limits, insurance |
| Fireblocks MPC ceremony completes | Signing stuck | 60s timeout, manual approval fallback |
| Network fees are sufficient | Tx stuck in mempool | Fee estimation before signing (future) |
| Provider webhook is reliable | Missed status updates | Polling fallback in executor |

## Monitoring

### Metrics to Watch

```
novex_withdrawal_completed_total    — successful withdrawals
novex_withdrawal_rejected_total     — rejected/failed
novex_order_placement_duration_ms   — (for executor timing)
```

### Alerts

```
- Withdrawal stuck in PROCESSING > 30 minutes → High
- Custody provider 5xx rate > 0 → Warning
- Signing timeout rate > 10% → High
- Broadcast with no txHash after 1 hour → Critical
```

## Test Commands

```bash
npm run test:custody    # Mock + resilient base + KMS sandbox tests
```
