# NovEx Pilot Incident Command Sheet

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Date** | _____________ |
| **Environment** | Production — `app.novex.io` |
| **Incident ID** | INC-_____________ |
| **Severity** | [ ] SEV-1 · [ ] SEV-2 · [ ] SEV-3 · [ ] SEV-4 |
| **Status** | [ ] Investigating · [ ] Mitigating · [ ] Monitoring · [ ] Resolved |

---

## 1. Incident Basics

| Field | Value |
|-------|-------|
| Detection time | _____________ |
| Detected by | [ ] Alert · [ ] Reconciliation · [ ] User report · [ ] Manual check |
| Incident Commander | _____________ |
| Affected systems | [ ] Trading · [ ] Funding · [ ] Wallets · [ ] WebSocket · [ ] Auth · [ ] Admin |
| User impact | [ ] None · [ ] Single user · [ ] Multiple users · [ ] All users |
| Financial impact | $ _____________ estimated |
| Regulatory relevance | [ ] None · [ ] Potential · [ ] Confirmed — notify compliance |

**Summary:**

_____________________________________________________________________________

_____________________________________________________________________________

---

## 2. Severity Guide

| Level | Criteria | Response | Examples |
|:-----:|----------|----------|---------|
| **SEV-1** | Fund loss risk, data breach, or reconciliation failure | < 5 min, all hands | Negative balance, unauthorized withdrawal, DB compromise |
| **SEV-2** | Degraded service affecting multiple users or financial operations | < 15 min, on-call + lead | Custody outage, elevated 5xx on /orders, stuck withdrawals |
| **SEV-3** | Limited impact, workaround exists | < 1 hour, on-call | KYC provider slow, single pair data stale, WS reconnect spike |
| **SEV-4** | Cosmetic or single-user issue | < 4 hours, support | UI rendering bug, one user can't log in, minor display error |

---

## 3. Command Roles

| Role | Name | Contact |
|------|------|---------|
| Incident Commander | _____________ | _____________ |
| Engineering Lead | _____________ | _____________ |
| Treasury / Ops Lead | _____________ | _____________ |
| Compliance Lead | _____________ | _____________ |
| Communications Owner | _____________ | _____________ |
| Scribe | _____________ | _____________ |
| Executive Notified | _____________ | _____________ |
| Escalation Backup | _____________ | _____________ |

**Incident channel:** _____________

---

## 4. Immediate Triage

```
[ ] Confirm incident scope and severity using §2 guide
[ ] Open dedicated incident channel and assign Scribe
[ ] Preserve logs: do NOT restart services until logs are captured
[ ] Check Grafana dashboards:
      [ ] Order placement rate / error rate
      [ ] Reconciliation mismatch count
      [ ] WebSocket active connections
      [ ] Treasury fee accrual
[ ] Run reconciliation if financial impact suspected:
      POST /admin/reconciliation/run?trigger=incident
[ ] Determine immediate containment:
      [ ] Halt trading?      → See §5 decision matrix
      [ ] Pause withdrawals? → See §5 decision matrix
      [ ] Disable deposits?  → See §5 decision matrix
[ ] Identify affected users, orders, and withdrawals
      SELECT count(*) FROM orders WHERE status = 'open';
      SELECT count(*) FROM withdrawals WHERE status IN ('pending','processing');
[ ] Assign investigation owner
[ ] Set next status update time: __________ (max 30 min for SEV-1/2)
```

---

## 5. Decision Matrix

| Trigger | Action | Authority |
|---------|--------|-----------|
| Negative balance detected | Halt all trading immediately | Any on-call |
| Reconciliation mismatch > 0 | Halt affected pair; investigate | Engineering Lead |
| Custody provider outage > 2h | Pause all withdrawals | Treasury Lead |
| KYC vendor outage | Inform users of delay; no halt | Compliance Lead |
| 3+ SEV-2 incidents in 24h | Stop entire pilot | Any two senior on-call |
| Platform value approaching $10K | Disable deposits | Treasury Lead |
| Suspected compromise | Stop pilot, rotate secrets, preserve evidence | CTO (unilateral) |
| Regulatory demand | Stop pilot, preserve all data | Compliance Lead (unilateral) |
| Cumulative losses > $500 | Stop pilot | CTO (unilateral) |
| Matching engine p95 > 500ms for 5 min | Halt affected pair | Engineering Lead |
| Withdrawal stuck PROCESSING > 30 min | Escalate to custody provider | Treasury + Engineering |

**To halt trading:**
```
POST /admin/governance/pair/halt  → requires second admin approval
OR emergency: POST /admin/governance/requests/{id}/emergency
OR direct: UPDATE trading_pairs SET is_active = false WHERE symbol = '...';
```

**To pause withdrawals:**
```
Block endpoint at WAF level, or set pending withdrawals to HOLD via admin panel
```

**To disable deposits:**
```
Set DEPOSIT_MONITOR_ENABLED=false and restart deposit monitor service
```

---

## 6. Communications Log

| Time | Audience | Message Summary | Sender | Channel |
|------|----------|----------------|--------|---------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## 7. User Communication Templates

**Trading halted:**
> Trading on [PAIR] is temporarily paused for maintenance. Open orders remain on book. We expect to resume within [TIME]. Your funds are safe.

**Withdrawals paused:**
> Withdrawals are temporarily paused while we perform a system check. Pending withdrawals will be processed when we resume. No funds are at risk.

**Deposits paused:**
> New deposits are temporarily paused. Any in-flight deposits will be credited once we resume. Do not send new deposits until further notice.

**KYC delays:**
> Our identity verification provider is experiencing delays. Your verification is queued and will complete when service resumes. Trading remains available for already-verified users.

**Pilot fully paused:**
> The NovEx pilot is temporarily paused for a scheduled review. All balances are preserved. We'll notify you when the platform is back. Contact pilot-support@novex.io with questions.

---

## 8. Resolution Checklist

Complete all items before marking incident Resolved.

```
[ ] Root cause identified and documented (§9 below)
[ ] Mitigation applied (code fix, config change, or manual correction)
[ ] Reconciliation run: 0 mismatches
      Run ID: _____________ Result: [ ] Pass · [ ] Fail
[ ] No duplicate trades found
      SELECT id, count(*) FROM trades GROUP BY id HAVING count(*) > 1;
[ ] No duplicate fee_ledger entries
      SELECT trade_id, source, count(*) FROM fee_ledger GROUP BY trade_id, source HAVING count(*) > 1;
[ ] All user balances non-negative
      SELECT * FROM wallets WHERE CAST(available AS DECIMAL) < 0 OR CAST(locked AS DECIMAL) < 0;
[ ] Treasury balance matches fee_ledger totals
[ ] All pending withdrawals reviewed (none stuck in invalid state)
[ ] Monitoring stable for 30+ minutes post-fix
[ ] No new alerts firing
[ ] User communications sent if users were affected
[ ] Resume approval obtained:
      Engineering Lead: _____________ [ ] Approved
      Treasury Lead:    _____________ [ ] Approved
      IC sign-off:      _____________ [ ] Approved
```

---

## 9. Post-Incident Review

*Complete within 48 hours of resolution. Blameless.*

**Root cause:**

_____________________________________________________________________________

_____________________________________________________________________________

**Timeline:**

| Time | Event |
|------|-------|
| | Incident detected |
| | Severity assigned |
| | Containment action taken |
| | Root cause identified |
| | Fix applied |
| | Reconciliation clean |
| | Incident resolved |

**Impact:**

| Metric | Value |
|--------|-------|
| Users affected | |
| Orders affected | |
| Withdrawals affected | |
| Financial loss | $ |
| Downtime duration | |

**What worked:**

_____________________________________________________________________________

**What failed or was missing:**

_____________________________________________________________________________

**Follow-up actions:**

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | [ ] Open |
| | | | [ ] Open |
| | | | [ ] Open |
