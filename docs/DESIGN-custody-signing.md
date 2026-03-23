# NovEx — Custody, Signing & Withdrawal Broadcast Architecture

## Problem

The previous `processWithdrawal()` method was a single monolithic function that mocked the entire signing/broadcast lifecycle. In production, this needs to be:

1. **Multi-step** — signing and broadcasting are separate operations
2. **Idempotent** — safe to retry at any point
3. **Auditable** — every step logged
4. **Secure** — private keys never in application memory
5. **Recoverable** — failed operations enter a reviewable state

## Architecture

```
                                ┌──────────────────────┐
                                │  Custody Provider     │
  WithdrawalExecutor            │  (HSM/MPC/Fireblocks) │
  ─────────────────             │                      │
  │                             │  ┌────────────────┐  │
  │  1. createIntent() ───────▶│  │ Register intent │  │
  │                             │  └────────────────┘  │
  │  2. requestSignature() ───▶│  │ Sign with key   │  │
  │                             │  │ (never exported) │  │
  │                             │  └────────────────┘  │
  │  3. broadcast() ──────────▶│  │ Submit to chain │  │
  │                             │  └────────────────┘  │
  │  4. getStatus() ──────────▶│  │ Check confirms  │  │
  │                             │  └────────────────┘  │
  └─────────────────            └──────────────────────┘
         │
         ▼
  ┌──────────────┐
  │  Settlement   │  Debit locked → Credit treasury → Mark COMPLETED
  └──────────────┘
```

## CustodyProvider Interface

```typescript
interface CustodyProvider {
  createIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult>;
  requestSignature(intentId: string): Promise<CustodySignResult>;
  broadcast(intentId: string): Promise<CustodyBroadcastResult>;
  getStatus(intentId: string): Promise<CustodyStatusResult>;
  cancelIntent(intentId: string): Promise<boolean>;
}
```

### Status Flow

```
PENDING_SIGNATURE → SIGNING → SIGNED → BROADCAST → CONFIRMED
                                │              │
                                └── FAILED ◄───┘
                                │
                                └── REJECTED (policy)
```

### Key Design Decisions

**intentId = withdrawalId**: The NovEx withdrawal ID serves as the custody intent ID. This provides natural idempotency — calling `createIntent()` twice with the same withdrawalId returns the same result.

**Signed-then-broadcast**: Signing and broadcasting are separate steps. This allows:
- Inspection of the signed transaction before broadcast
- Retry of broadcast without re-signing
- Cancellation between signing and broadcast

**Settlement after broadcast, not after confirmation**: We settle (debit locked funds) immediately after a successful broadcast rather than waiting for on-chain confirmation. This is standard exchange practice — the funds were already locked when the user requested the withdrawal.

## Idempotency Guarantees

| Step | Behavior on Retry |
|------|-------------------|
| `createIntent()` | Returns existing intent (same providerRef) |
| `requestSignature()` | Returns existing signature (same signedTx) |
| `broadcast()` | Returns existing txHash (no double-broadcast) |
| `execute()` | In-flight guard prevents concurrent processing; terminal states return immediately |

### Double-Broadcast Prevention

```
execute("wd-001", admin2)
  │
  ├── this.inflight.has("wd-001") → true → throw "already being processed"
  │
  ├── w.status === COMPLETED → return immediately
  │
  ├── custody.broadcast("wd-001")
  │   └── Already broadcast → return existing txHash (no new tx)
  │
  └── Settlement runs once (in transaction, status check prevents double-settle)
```

## Maker-Checker Preservation

The `WithdrawalExecutorService.execute()` method enforces:

```
if (operatorId === w.reviewedBy) → throw ForbiddenException("Maker-checker")
```

This check runs before any custody operations begin, ensuring that the separation of duties established during approval cannot be bypassed through the execution path.

## Audit Trail

Every custody operation produces an audit log entry:

| Action | When |
|--------|------|
| `withdrawal.custody_intent_created` | After createIntent() |
| `withdrawal.signed` | After requestSignature() succeeds |
| `withdrawal.broadcast_settled` | After broadcast() + settlement |
| `withdrawal.execution_failed` | On any failure (signing, broadcast, settlement) |
| `withdrawal.custody_rejected` | When custody policy blocks the withdrawal |
| `withdrawal.custody_intent_cancelled` | When intent is cancelled before broadcast |

## Recommended Custody Patterns

### Pattern 1: HSM-Backed Signer (AWS CloudHSM)

```
Best for: Exchanges with dedicated security team
Cost: $1,200/month per HSM + development

How it works:
  - Private keys generated inside HSM, never exported
  - Application sends unsigned tx payload → HSM signs → returns signature
  - NovEx broadcasts the signed transaction

Implementation:
  class CloudHsmCustodyProvider implements CustodyProvider {
    requestSignature(intentId) {
      const unsignedTx = this.buildUnsignedTx(intent);
      const signature = await cloudHsm.sign(keyId, unsignedTx);
      return { signedTx: assembleTx(unsignedTx, signature) };
    }
  }

Pros: Keys never leave hardware, full control
Cons: Single point of failure, requires key management expertise
```

### Pattern 2: MPC/Custody Provider (Fireblocks, Copper, BitGo)

```
Best for: Exchanges wanting operational simplicity
Cost: $2,000–$10,000/month + per-tx fees

How it works:
  - Private keys are split across multiple parties (MPC threshold signing)
  - NovEx creates a withdrawal intent via API → provider handles signing + broadcast
  - Provider's policy engine can add additional approval requirements

Implementation:
  class FireblocksCustodyProvider implements CustodyProvider {
    createIntent(intent) {
      return fireblocks.createTransaction({
        assetId: mapAsset(intent.asset),
        destination: { type: 'ONE_TIME_ADDRESS', address: intent.to },
        amount: intent.amount,
        externalTxId: intent.intentId, // idempotency key
      });
    }
    broadcast(intentId) {
      // Fireblocks handles signing + broadcast internally
      return fireblocks.getTransaction(intentId);
    }
  }

Pros: No key management burden, built-in policy engine, insurance coverage
Cons: Vendor dependency, per-transaction cost, less control
```

### Pattern 3: Hot Wallet (Direct Key in KMS)

```
Best for: Internal alpha/beta only
Cost: Minimal (KMS charges per sign operation)

How it works:
  - Single private key stored in AWS KMS or Secrets Manager
  - Application fetches key → signs in memory → broadcasts
  - Fastest execution but highest risk surface

Risk tradeoffs:
  - Key compromise = total loss of hot wallet funds
  - No MPC threshold protection
  - No external policy engine
  - Suitable ONLY when hot wallet holds < 5% of total assets

Mitigation:
  - Maximum hot wallet balance enforced
  - Auto-sweep to cold wallet on threshold
  - Real-time monitoring for large outflows
  - Insurance if available
```

### Recommendation for NovEx

| Phase | Pattern | Rationale |
|-------|---------|-----------|
| Internal Alpha | Mock provider | No real funds at risk |
| Beta (testnet) | Hot wallet (KMS) | Fast iteration, testnet funds only |
| Production MVP | Fireblocks or BitGo | Security + operational simplicity |
| Production Scale | HSM + MPC hybrid | HSM for cold, MPC for hot |

## Failure Recovery

### Failed Signing

```
State: PROCESSING, custody status: FAILED
Action: Admin reviews → either retry execution or reject withdrawal

Retry: call execute() again → custody.requestSignature() retries
  (custody provider may have a cooldown or require manual intervention)

Reject: call recoverFailedWithdrawal() → funds returned to user
```

### Failed Broadcast

```
State: PROCESSING, custody status: FAILED (after signing)
Risk: Signed transaction exists but was not broadcast

Investigation:
  1. Check if signed tx was actually broadcast (scan mempool)
  2. If yes: manually update withdrawal with txHash
  3. If no: safe to retry — custody.broadcast() will re-broadcast

Recovery: call execute() again → broadcast() retries with same signed tx
```

### Broadcast Timeout (Unknown State)

```
State: PROCESSING, no txHash recorded
Risk: Transaction may or may not have been submitted

This is the most dangerous state. Steps:
  1. Check custody.getStatus(intentId) for provider-side state
  2. Check blockchain mempool/explorer for the signed tx
  3. If found on-chain: manually complete the withdrawal
  4. If not found after 1 hour: retry broadcast or reject

The signed transaction has a nonce — broadcasting it twice just means
the second one is rejected by the network (nonce already used).
```

## Test Coverage

```bash
npm run test:custody   # 11 unit tests for MockCustodyProvider
```

| Test | Scenario |
|------|----------|
| Happy path | create → sign → broadcast → confirm |
| Intent idempotency | Double createIntent → same result |
| Signature idempotency | Double requestSignature → same signedTx |
| Broadcast idempotency | Double broadcast → same txHash (no double-broadcast) |
| Signing failure | HSM unavailable → FAILED |
| Broadcast failure | Network timeout → FAILED |
| Broadcast before signing | Throws (invalid state) |
| Cancel before broadcast | Succeeds |
| Cancel after broadcast | Returns false |
| Unknown intent | All operations throw |
| Delayed confirmation | getStatus reflects confirmation count |
