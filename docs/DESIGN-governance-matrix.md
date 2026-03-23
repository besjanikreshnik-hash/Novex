# NovEx — Governance Matrix & Separation-of-Duties Policy

## Role Hierarchy

```
ADMIN (level 5) — Full access, emergency powers, role management
  ├── TREASURY (level 4) — Withdrawal approval/processing, funding operations
  ├── OPS (level 3) — Trading pair management, fee config, system operations
  ├── COMPLIANCE (level 2) — KYC review, user management, AML
  ├── SUPPORT (level 1) — Read-only dashboards, user lookup
  └── USER (level 0) — Trading, deposits, withdrawals (within limits)
```

Higher roles inherit all permissions of lower roles. ADMIN can do everything any role can do.

## Governance Matrix

### Action Permissions

| Action | Who Can Propose | Who Can Approve | Maker-Checker | Emergency Bypass |
|--------|----------------|-----------------|:---:|:---:|
| Trading pair halt | OPS+ | OPS+ (different admin) | Yes | ADMIN only |
| Trading pair unhalt | OPS+ | OPS+ (different admin) | Yes | ADMIN only |
| Fee configuration change | OPS+ | OPS+ (different admin) | Yes | ADMIN only |
| System config change | OPS+ | OPS+ (different admin) | Yes | ADMIN only |
| Withdrawal limit change | OPS+ | OPS+ (different admin) | Yes | ADMIN only |
| KYC manual override | COMPLIANCE+ | COMPLIANCE+ (different admin) | Yes | ADMIN only |
| Withdrawal approval | TREASURY+ | — (single-step) | No* | — |
| Withdrawal processing | TREASURY+ | — (single-step) | Yes** | — |
| User freeze/unfreeze | COMPLIANCE+ | — (single-step) | No | — |

\* Withdrawal approval is single-step but requires the approver to differ from the withdrawing user.
\** Withdrawal processing enforces maker-checker: the processor must differ from the approver.

### Direct Admin Actions (No Change Request Needed)

| Action | Minimum Role | Audit Logged |
|--------|-------------|:---:|
| View pending withdrawals | TREASURY+ | No (read-only) |
| View audit logs | SUPPORT+ | No (read-only) |
| Run reconciliation | OPS+ | Yes |
| View metrics | SUPPORT+ | No (read-only) |

## Change Request Lifecycle

```
Proposer (OPS/COMPLIANCE/ADMIN) creates request
  │
  ├── Status: PENDING (expires in 24h)
  │
  ├── Different admin approves → APPROVED → auto-executed → EXECUTED
  │
  ├── Any admin rejects → REJECTED (with mandatory note)
  │
  ├── ADMIN emergency-executes → EXECUTED (flagged as emergency)
  │
  └── Expiry timer → EXPIRED (no action taken)
```

### Key Properties

| Property | Implementation |
|----------|---------------|
| **Maker-checker** | `approvedBy !== proposedBy` enforced in `approve()` |
| **Previous state capture** | `previousState` JSON stored on creation (enables rollback reference) |
| **Auto-execution** | Approved changes execute immediately (no separate execute step) |
| **Emergency bypass** | ADMIN-only, requires justification, flagged `isEmergency=true` |
| **Expiry** | Pending requests expire after 24 hours |
| **Full audit trail** | Every step (propose/approve/reject/execute/emergency) logged |

## Emergency Powers

Only ADMIN role can use emergency execution. This bypasses maker-checker but:

1. **Requires written justification** (stored in the change request)
2. **Flagged as emergency** (`isEmergency: true`) in the database
3. **Audit logged** with special action: `governance.emergency_execute.{type}`
4. **Mandatory post-incident review** within 24 hours

Emergency use cases:
- Active security exploit requiring immediate pair halt
- Critical bug in fee calculation requiring instant fee change
- Regulatory demand with imminent deadline

## Audit Coverage

Every governance action produces an audit log entry:

| Audit Action | Fields |
|-------------|--------|
| `governance.proposed.{type}` | proposerId, description, payload |
| `governance.approved.{type}` | approverId, note, proposedBy |
| `governance.rejected.{type}` | rejecterId, note, proposedBy |
| `governance.executed.{type}` | executorId, payload, previousState |
| `governance.emergency_execute.{type}` | operatorId, justification, isEmergency |

## Funding-Specific Governance

The funding module has its own embedded maker-checker (predating this governance system):

| Action | Proposer | Checker | Enforcement |
|--------|----------|---------|-------------|
| Withdrawal approval | TREASURY+ | — | `approveWithdrawal()` checks `userId !== adminId` |
| Withdrawal processing | TREASURY+ | Different from approver | `processWithdrawal()` checks `processedBy !== reviewedBy` |
| Withdrawal rejection | TREASURY+ | — | Single-step, audit logged |
| Withdrawal recovery | TREASURY+ | — | Single-step, audit logged |

This remains separate because withdrawal approval is time-sensitive (users are waiting) and doesn't benefit from the 24h expiry model of governance change requests.

## API Endpoints

```
POST /admin/governance/pair/halt         — Propose pair halt (OPS+)
POST /admin/governance/pair/unhalt       — Propose pair unhalt (OPS+)
POST /admin/governance/fees/change       — Propose fee change (OPS+)
POST /admin/governance/kyc/override      — Propose KYC override (COMPLIANCE+)
POST /admin/governance/requests/:id/approve  — Approve (OPS+, different from proposer)
POST /admin/governance/requests/:id/reject   — Reject (OPS+)
POST /admin/governance/requests/:id/emergency — Emergency execute (ADMIN only)
GET  /admin/governance/requests/pending     — List pending (OPS+)
GET  /admin/governance/requests             — List all (OPS+)
GET  /admin/governance/requests/:id         — Get details (OPS+)
```

## Test Coverage

```bash
npm run test:governance   # 11 integration tests
```

| # | Scenario | What It Proves |
|---|----------|---------------|
| 1 | Propose → approve → executed | Happy path works |
| 2 | Self-approval blocked | Maker-checker enforced |
| 3 | Double-approve blocked | State machine correct |
| 4 | Reject prevents execution | Rejection is terminal |
| 5 | Expired request rejected | Time-based expiry works |
| 6 | Emergency bypass | ADMIN can override maker-checker |
| 7 | Pair halt/unhalt roundtrip | Trading pair state changes |
| 8 | Fee change verified | Fee values update correctly |
| 9 | KYC override verified | User KYC status changes |
| 10 | Previous state captured | Rollback data preserved |
| 11 | Audit trail complete | All 3+ actions logged |
