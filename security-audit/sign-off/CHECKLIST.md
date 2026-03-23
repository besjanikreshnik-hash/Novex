# NovEx — Security Sign-Off Checklist

Each domain must be signed off by the auditor AND the internal security owner before pilot launch.

## Domain 1: Authentication & Session Management

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 1.1 | JWT secret is unique, ≥32 chars, not in code | [ ] | | |
| 1.2 | JWT secret fails fast if missing on startup | [ ] | | |
| 1.3 | Access token TTL ≤ 15 minutes | [ ] | | |
| 1.4 | Refresh token rotation implemented and tested | [ ] | | |
| 1.5 | Refresh token reuse detection revokes all sessions | [ ] | | |
| 1.6 | Password hashing uses bcrypt with ≥ 12 rounds | [ ] | | |
| 1.7 | Login rate limiting: 5/min per IP | [ ] | | |
| 1.8 | Registration rate limiting: 3/hour per IP | [ ] | | |
| 1.9 | No credentials exposed in API responses | [ ] | | |
| 1.10 | No credentials in logs | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Domain 2: RBAC & Governance

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 2.1 | Role hierarchy enforced (USER < SUPPORT < COMPLIANCE < OPS < TREASURY < ADMIN) | [ ] | | |
| 2.2 | Regular user cannot access admin endpoints | [ ] | | |
| 2.3 | Governance change requests require maker-checker | [ ] | | |
| 2.4 | Emergency execute is ADMIN-only and flagged | [ ] | | |
| 2.5 | Governance changes expire after 24 hours | [ ] | | |
| 2.6 | All governance actions have audit log entries | [ ] | | |
| 2.7 | Admin IP allowlist configured for production | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Domain 3: Trading & Settlement

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 3.1 | KYC Tier 1 required for trading | [ ] | | |
| 3.2 | Suspended accounts cannot trade | [ ] | | |
| 3.3 | Order placement rate limited: 10/10s per user | [ ] | | |
| 3.4 | Halted pair rejects orders | [ ] | | |
| 3.5 | Settlement is atomic (single transaction) | [ ] | | |
| 3.6 | Fees use decimal arithmetic (no floating point) | [ ] | | |
| 3.7 | Fee ledger entries exist for every trade | [ ] | | |
| 3.8 | Treasury balance matches fee ledger totals | [ ] | | |
| 3.9 | Self-trade prevention active | [ ] | | |
| 3.10 | Idempotency keys prevent duplicate orders | [ ] | | |
| 3.11 | Optimistic locking prevents double-spend | [ ] | | |
| 3.12 | Market order rejects on empty book | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Domain 4: Funding & Custody

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 4.1 | Deposit detection is idempotent on txHash | [ ] | | |
| 4.2 | Deposits credited exactly once after confirmation threshold | [ ] | | |
| 4.3 | Withdrawal requires KYC Tier 1 | [ ] | | |
| 4.4 | Withdrawal to new address has 24h hold | [ ] | | |
| 4.5 | Withdrawal approval has self-approval prohibition | [ ] | | |
| 4.6 | Withdrawal processing has maker-checker (approver ≠ processor) | [ ] | | |
| 4.7 | 2FA required for withdrawal submission | [ ] | | |
| 4.8 | Daily withdrawal limits enforced per KYC tier | [ ] | | |
| 4.9 | Custody pipeline is idempotent (no double-broadcast) | [ ] | | |
| 4.10 | Failed withdrawals are recoverable | [ ] | | |
| 4.11 | All funding state transitions have audit log entries | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Domain 5: WebSocket & Real-Time

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 5.1 | Private channels require JWT authentication | [ ] | | |
| 5.2 | Unauthenticated clients cannot join user:{id} rooms | [ ] | | |
| 5.3 | Connection limit: 5 per IP | [ ] | | |
| 5.4 | Message rate limit: 100/min per connection | [ ] | | |
| 5.5 | Sequence numbers prevent duplicate event application | [ ] | | |
| 5.6 | Expired tokens rejected on authenticate | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Domain 6: Rate Limiting & Abuse Controls

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 6.1 | HTTP rate limits return structured 429 with Retry-After | [ ] | | |
| 6.2 | Per-user limits on authenticated endpoints | [ ] | | |
| 6.3 | Per-IP limits on unauthenticated endpoints | [ ] | | |
| 6.4 | WebSocket connection/message/subscribe limits active | [ ] | | |
| 6.5 | No rate limit bypass via header manipulation | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Domain 7: Reconciliation & Disaster Recovery

| # | Check | Status | Verified By | Date |
|---|-------|--------|-------------|------|
| 7.1 | Reconciliation checks all 7 invariants | [ ] | | |
| 7.2 | Reconciliation run after load test passes with 0 mismatches | [ ] | | |
| 7.3 | Backup script produces valid, restorable backup | [ ] | | |
| 7.4 | Restore + validate script passes all 11 checks | [ ] | | |
| 7.5 | DR test completed within the last 30 days | [ ] | | |
| 7.6 | RPO ≤ 5 minutes (RDS PITR configured) | [ ] | | |
| 7.7 | RTO ≤ 30 minutes (restore procedure documented and tested) | [ ] | | |

**Sign-off:** _____________________ Date: __________

## Final Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| External Auditor | | | |
| Internal Security Lead | | | |
| CTO / Engineering Lead | | | |
