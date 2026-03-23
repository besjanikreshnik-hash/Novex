# NovEx — Funding Admin Controls & Maker-Checker Workflow

## RBAC Enforcement

All admin withdrawal endpoints require `role === 'admin'` via `AdminRoleGuard`:

| Endpoint | Guard | Required Role |
|----------|-------|--------------|
| `GET /admin/withdrawals/pending` | `JwtAuthGuard + AdminRoleGuard` | admin |
| `POST /admin/withdrawals/:id/approve` | `JwtAuthGuard + AdminRoleGuard` | admin |
| `POST /admin/withdrawals/:id/reject` | `JwtAuthGuard + AdminRoleGuard` | admin |
| `POST /admin/withdrawals/:id/process` | `JwtAuthGuard + AdminRoleGuard` | admin |
| `POST /admin/withdrawals/:id/recover` | `JwtAuthGuard + AdminRoleGuard` | admin |

A non-admin user receives `403 Forbidden` with message: "This action requires one of: admin."

## Maker-Checker (Separation of Duties)

### Rules

| Rule | Enforcement Point | Error Message |
|------|-------------------|---------------|
| Admin cannot approve their own withdrawal | `approveWithdrawal()` | "Cannot approve your own withdrawal" |
| Admin who approved cannot process | `processWithdrawal()` | "Maker-checker violation: the admin who approved this withdrawal cannot also process it" |

### Why Two Steps

The withdrawal lifecycle has two distinct authorization decisions:

1. **Approve** (Maker): "This withdrawal looks legitimate and within policy"
2. **Process** (Checker): "I confirm execution and will broadcast the transaction"

Requiring different people prevents a single compromised admin from both authorizing and executing a theft.

### Data Model

```
Withdrawal entity:
  reviewedBy    — UUID of admin who approved/rejected
  reviewedAt    — timestamp of review
  processedBy   — UUID of admin who executed (must differ from reviewedBy)
  processedAt   — timestamp of execution
```

## State Machine

```
User requests → PENDING / HOLD
                   │
          Admin approves → APPROVED
          Admin rejects  → REJECTED (funds unlocked)
                              │
                    Different admin processes → PROCESSING
                                                  │
                                         Success → COMPLETED
                                         Failure → FAILED
                                                     │
                                            Admin recovers → REJECTED (funds unlocked)
```

### Valid Transitions

| From | To | Who | Condition |
|------|----|-----|-----------|
| PENDING/HOLD | APPROVED | Admin (not withdrawal owner) | Hold period expired |
| PENDING/HOLD | REJECTED | Any admin | — |
| APPROVED | PROCESSING | Different admin from approver | Maker-checker |
| APPROVED | REJECTED | Any admin | Reversal |
| PROCESSING | COMPLETED | System | Broadcast success |
| PROCESSING | FAILED | System | Broadcast failure |
| FAILED | REJECTED | Any admin | Recovery (funds returned) |

## Audit Trail

Every state transition produces an audit log entry:

| Action | Logged Fields |
|--------|--------------|
| `withdrawal.approved` | adminId, withdrawalUserId, amount, asset, address, note |
| `withdrawal.rejected` | adminId, amount, asset, note, previousStatus |
| `withdrawal.processing` | processorId, approverId, amount, asset, address |
| `withdrawal.completed` | processorId, txHash, amount, asset, address |
| `withdrawal.failed` | processorId, error message |
| `withdrawal.recovered` | adminId, amount, asset, originalProcessor |

All audit logs are persisted to the `audit_logs` table and published to Kafka.

## Operator Workflow

### Standard Withdrawal Review

```
1. Open admin panel → Withdrawals → Pending queue
2. Review withdrawal details (amount, address, user KYC tier, risk score)
3. Decision:
   a. Approve: Click "Approve" with optional note
      → Withdrawal moves to APPROVED
      → Different admin must process
   b. Reject: Click "Reject" with required note
      → User's funds are unlocked immediately

4. Processing (different admin):
   a. Open approved withdrawals queue
   b. Verify approval is legitimate
   c. Click "Process" to execute
   → System broadcasts transaction and marks COMPLETED
```

### Exception Handling

**Withdrawal stuck in PROCESSING:**
- Check blockchain explorer for the txHash
- If mined and confirmed → manually update to COMPLETED
- If not mined after 1 hour → mark as FAILED, then recover

**Failed withdrawal recovery:**
1. Admin clicks "Recover" on the failed withdrawal
2. Funds are unlocked back to the user's available balance
3. Recovery is audit-logged with the original processor ID
4. User can submit a new withdrawal request

**Suspicious withdrawal:**
1. If flagged by risk scoring → status is HOLD (24h)
2. Admin reviews KYC, transaction history, and address risk
3. If suspicious: reject with detailed note
4. If legitimate: approve after hold expires

## Test Coverage

```bash
npm run test:admin-controls   # 9 integration tests
```

| Test | Scenario |
|------|----------|
| 1 | Self-approval blocked |
| 2 | Same admin approve+process blocked (maker-checker) |
| 3 | Different admins approve+process succeeds |
| 4 | Double-approve race fails |
| 5 | Approve-then-reject reversal works |
| 6 | Process replay on completed fails |
| 7 | Full lifecycle audit trail (3+ entries) |
| 8 | Rejection audit entry with note |
| 9 | Recovery audit entry with original processor |
