# NovEx — Sandbox Provider Integration Guide

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  NovEx       │────▶│ Provider Layer    │────▶│ Sumsub API   │
│  Backend     │     │ (KYC_PROVIDER)    │     │ (sandbox)    │
│              │◀────│                   │◀────│              │
│              │     ├──────────────────┤     ├──────────────┤
│              │────▶│ Provider Layer    │────▶│ Alchemy API  │
│              │     │ (BLOCKCHAIN_     │     │ (Sepolia)    │
│              │◀────│  PROVIDER)        │◀────│              │
└─────────────┘     └──────────────────┘     └──────────────┘
```

Both providers are selected at startup via env vars. Default: `mock` (no external calls).

## Scope A — KYC: Sumsub Sandbox

### Setup

1. **Create Sumsub account**: https://sumsub.com → Sign up for sandbox
2. **Create API app token**: Dashboard → Developer → API → Create token
3. **Configure webhook**: Dashboard → Developer → Webhooks → Add endpoint
   - URL: `https://your-domain/api/v1/webhooks/kyc`
   - Events: applicantReviewed, applicantPending
4. **Note the webhook secret** from the webhook configuration page
5. **Set env vars**:

```env
KYC_PROVIDER_TYPE=sumsub
SUMSUB_APP_TOKEN=sbx_xxxxxxxxx
SUMSUB_SECRET_KEY=your_secret_key_here
SUMSUB_BASE_URL=https://test-api.sumsub.com
SUMSUB_WEBHOOK_SECRET=your_webhook_secret
SUMSUB_LEVEL_NAME=basic-kyc-level
```

### Verification Flow

```
1. User calls POST /api/v1/kyc/session (not yet wired — use KycService.createSession)
2. Backend creates Sumsub applicant → returns verificationUrl
3. User opens URL → completes document upload + selfie in Sumsub widget
4. Sumsub reviews (auto in sandbox) → sends webhook to /api/v1/webhooks/kyc
5. NovEx processes webhook → updates user.kycStatus
6. User can now trade/withdraw (KycTierGuard passes)
```

### Testing Sumsub Sandbox

In the Sumsub sandbox dashboard:
- **Auto-approve**: Upload any document → automatically approved
- **Force rejection**: Use document number `REJECT` → automatically rejected
- **Webhook replay**: Dashboard → Webhooks → select event → Resend

### Mock Provider (default)

Email-based behavior for development:
- `user@approved.test` → instant approval (tier 1)
- `user@rejected.test` → instant rejection
- `user@pending.test` → stays pending
- `user@retry.test` → retry state
- Other emails → pending until webhook

## Scope B — Blockchain: Alchemy Sandbox

### Setup

1. **Create Alchemy account**: https://alchemy.com → Sign up (free tier works)
2. **Create app**: Dashboard → Create App → Network: Ethereum Sepolia
3. **Get API key** from the app dashboard
4. **Optional — Address Activity webhook**: Dashboard → Webhooks → Create
   - URL: `https://your-domain/api/v1/webhooks/blockchain`
   - Type: Address Activity
   - Network: ETH_SEPOLIA

```env
BLOCKCHAIN_PROVIDER_TYPE=alchemy
ALCHEMY_API_KEY=your_alchemy_key
ALCHEMY_BASE_URL=https://eth-sepolia.g.alchemy.com/v2
ALCHEMY_NETWORK=eth-sepolia
DEPOSIT_MONITOR_ENABLED=true
DEPOSIT_POLL_INTERVAL_MS=30000
```

### Deposit Flow (Testnet)

```
1. User calls POST /api/v1/deposit-address → gets testnet address
2. Send testnet ETH to that address (use Sepolia faucet)
3. DepositMonitor polls every 30s → detects deposit
4. Tracks confirmations → credits after 12 confirms (~3 min on Sepolia)
5. User's wallet balance updates
```

### Getting Testnet ETH

- Sepolia faucet: https://sepoliafaucet.com
- Alchemy faucet: https://sepoliafaucet.com (sign in with Alchemy account)

### Withdrawal Flow (Sandbox)

In sandbox mode, withdrawal broadcast returns a **mock txHash**. Real on-chain signing requires HSM/KMS integration which is not included in sandbox. The flow:

```
1. User requests withdrawal → funds locked → status: PENDING/HOLD
2. Admin approves → status: APPROVED
3. Worker calls processWithdrawal() → mock broadcast → status: COMPLETED
4. In production: replace mock with real signing via AWS CloudHSM
```

### Mock Provider (default)

For development without external calls:
- `generateAddress()` → deterministic test address
- `simulateDeposit()` → inject fake deposits for testing
- `advanceConfirmations()` → simulate block progression
- `broadcastWithdrawal()` → mock txHash
- `failBroadcast()` → simulate failed broadcast

## Operator Runbook

### KYC Provider Errors

| Error | Cause | Action |
|-------|-------|--------|
| `KYC provider error: 401` | Invalid/expired API token | Rotate SUMSUB_APP_TOKEN |
| `KYC provider error: 429` | Rate limited by Sumsub | Reduce poll frequency |
| Webhook signature fail | Wrong SUMSUB_WEBHOOK_SECRET | Update secret from Sumsub dashboard |
| Applicant stuck in PENDING | Sumsub review delay | Check Sumsub dashboard → manual review |
| Webhook never arrives | Firewall blocking, wrong URL | Check Sumsub webhook logs, verify endpoint accessible |

### Blockchain Provider Errors

| Error | Cause | Action |
|-------|-------|--------|
| `Alchemy RPC error: 401` | Invalid API key | Rotate ALCHEMY_API_KEY |
| `Alchemy RPC error: 429` | Rate limited | Upgrade Alchemy plan or reduce poll frequency |
| Deposit not detected | Poll interval too long, or different network | Check ALCHEMY_NETWORK matches deposit chain |
| Deposit credited twice | Bug in crediting logic | Run reconciliation, investigate `deposit.status` |
| Withdrawal broadcast fail | Network congestion, insufficient gas | Retry with higher gas price, or recover manually |
| Withdrawal stuck PROCESSING | On-chain tx not mined | Check tx on block explorer, increase gas |

### Manual Recovery Procedures

**KYC stuck in PENDING:**
```bash
# Poll vendor for latest status
curl -X POST localhost:3000/api/v1/admin/kyc/poll/:externalId

# Or manually approve for testing
UPDATE users SET kyc_status = 'verified' WHERE id = 'user-id';
```

**Deposit not credited (confirmed on-chain but not in NovEx):**
```bash
# Manually trigger confirmation update
curl -X POST localhost:3000/api/v1/admin/deposits/confirm \
  -d '{"txHash": "0x...", "confirmations": 20}'
```

**Failed withdrawal recovery:**
```bash
# Unlock funds and mark as rejected
curl -X POST localhost:3000/api/v1/admin/withdrawals/:id/recover
```

## Metrics

Provider calls are tracked in Prometheus:
- `novex_deposit_credited_total{asset,network}` — successful deposits
- `novex_withdrawal_completed_total{asset,network}` — successful withdrawals
- `novex_withdrawal_rejected_total{reason}` — rejected withdrawals
- Provider-level latency and error counts should be added per-adapter in production.

## Test Commands

```bash
npm run test:providers   # Unit tests for mock KYC and blockchain providers
npm run test:funding     # Integration tests for deposit/withdrawal lifecycle
```
