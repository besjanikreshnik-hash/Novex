# NovEx — Web-Only Pilot Operations Runbook

*Effective from pilot launch date. Review and update weekly.*

---

## 1. Pilot Scope & Constraints

| Parameter | Value | Enforcement |
|-----------|-------|-------------|
| Platform | Web only (app.novex.io) | Mobile/extension not deployed |
| Users | ≤ 50 invited | Registration gated by invite code |
| Total platform value | ≤ $10,000 across all users | Monitored via treasury dashboard |
| Trading pairs | BTC/USDT, ETH/USDT, SOL/USDT | Only these seeded; admin can halt any |
| Order types | Limit + Market | Market orders have slippage guardrails |
| Deposit methods | Crypto only (on-chain) | No fiat on-ramp |
| Withdrawal daily limit | $5,000 per verified user | Enforced by WithdrawalLimitsGuard |
| Hot wallet max | ≤ $500 per asset (5% of max platform value) | Manual sweep to cold if exceeded |
| KYC tier required | Tier 1 (verified) for trading and withdrawals | Backend KycTierGuard enforces |
| 2FA required | For all withdrawals | TwoFactorGuard enforces |
| Admin access | IP-allowlisted, role-gated | AdminIpGuard + AdminRoleGuard |

---

## 2. Pre-Launch Checklist

Complete **all items** before announcing to pilot users.

### Infrastructure

```
[ ] PostgreSQL production instance running with PITR backups enabled
[ ] DATABASE_SSL=true with valid CA cert path verified
[ ] Redis cluster running (ElastiCache or Docker)
[ ] Kafka/MSK running (or disabled with audit writing to DB only)
[ ] Backend deployed and healthy (GET /api/v1/market/pairs returns data)
[ ] Web app deployed and accessible at pilot domain
[ ] WAF rules active on load balancer
[ ] DDoS protection enabled
```

### Security

```
[ ] JWT_SECRET is unique 64+ character random string in Secrets Manager
[ ] METRICS_TOKEN set and configured in Prometheus scraper
[ ] ADMIN_IP_ALLOWLIST set to team VPN/office IPs
[ ] NODE_ENV=production verified
[ ] CORS restricted to pilot domain only
[ ] npm audit shows 0 critical vulnerabilities
[ ] Container images scanned with Trivy (0 critical)
```

### Data

```
[ ] Database seeded with trading pairs (BTC/USDT, ETH/USDT, SOL/USDT)
[ ] Platform treasury user exists (00000000-0000-0000-0000-000000000001)
[ ] Fee schedules configured (maker: 0.1%, taker: 0.2%)
[ ] No test/dev data remaining in production database
```

### Operations

```
[ ] On-call rotation established (≥ 2 people, 24/7 for first 72 hours)
[ ] PagerDuty/Slack alert channels configured
[ ] Grafana dashboards accessible to on-call
[ ] All alert rules firing correctly (send test alert)
[ ] Reconciliation cron job scheduled (hourly)
[ ] DR test completed within last 7 days
[ ] This runbook reviewed by all on-call personnel
[ ] Pilot user invite list finalized (≤ 50)
```

### Sign-Off

```
[ ] CTO approves launch: _________________ Date: _________
[ ] Security lead approves: ______________ Date: _________
[ ] Compliance lead approves: ____________ Date: _________
```

---

## 3. Launch-Day Checklist

### T-60 minutes

```
[ ] Verify all infrastructure healthy (backend, DB, Redis, web)
[ ] Run reconciliation manually: POST /admin/reconciliation/run → 0 mismatches
[ ] Verify Grafana dashboards loading with live data
[ ] Verify on-call personnel are available and have access
[ ] Confirm rollback procedure is ready (pair halt via governance)
```

### T-0 (Go Live)

```
[ ] Send invitation emails to pilot users (use template §10.1)
[ ] Enable registration for invited emails
[ ] Monitor Grafana "Order Placement Rate" panel for first activity
[ ] Monitor error rate panels — any 5xx within first 10 minutes = investigate
```

### T+30 minutes

```
[ ] Verify first user registrations succeeded
[ ] Verify first login events in audit log
[ ] Verify KYC flow accessible (even if mock provider)
[ ] Check WebSocket connections panel — users should be connected
```

### T+60 minutes

```
[ ] Verify first trade executed (check trades table and Grafana)
[ ] Run reconciliation: POST /admin/reconciliation/run → 0 mismatches
[ ] Check treasury fee wallets — should show collected fees
[ ] Send "successful launch" status to team (use template §10.3)
```

---

## 4. First-72-Hours Monitoring Routine

### Every Hour (automated + human check)

```
1. Reconciliation runs automatically (cron)
   → Check Grafana: novex_reconciliation_mismatch_total should be 0
   → If > 0: IMMEDIATE escalation (see §9 Halt Criteria)

2. Check error rate dashboard
   → 5xx rate on /orders should be < 1%
   → If > 1% for 5+ minutes: investigate

3. Check WebSocket connections
   → Active connections should roughly match active user count
   → Disconnect rate > 50/min: investigate gateway health
```

### Every 4 Hours (human)

```
1. Review pending withdrawal queue: GET /admin/withdrawals/pending
   → Process any pending withdrawals per §6
   → Flag any unusual patterns (large amounts, many from same user)

2. Check total platform value
   → SUM(available + locked) across all user wallets
   → If approaching $10,000 limit: pause deposits (see §9)

3. Review audit logs for admin actions
   → Any unexpected admin actions? Any admin login from unusual IP?

4. Check hot wallet balances
   → If any asset > $500: sweep excess to cold wallet
```

### Daily (end of day)

```
1. Generate daily report (see §12)
2. Review all trades executed that day
3. Review all deposits and withdrawals
4. Verify reconciliation has passed all runs (0 mismatches all day)
5. Post daily report to team channel (use template §10.4)
```

---

## 5. Hourly Reconciliation Procedure

### Automated (Cron)

```bash
# Runs every hour via cron or Kubernetes CronJob
curl -X POST https://api.novex.io/api/v1/admin/reconciliation/run?trigger=scheduler \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### On Mismatch

If `mismatch_count > 0`:

```
1. IMMEDIATELY alert on-call via PagerDuty
2. Check mismatch details:
   GET /admin/reconciliation/runs/{runId}
3. Classify severity:
   - NEGATIVE_AVAILABLE or NEGATIVE_LOCKED → SEV-1 (see §8)
   - FEE_LEDGER_TREASURY_MISMATCH → SEV-1
   - MISSING_FEE_LEDGER_ENTRY → SEV-2
   - ORDER_OVERFILL → SEV-1
   - TRADE_QUOTE_MISMATCH → SEV-2
4. If SEV-1: halt all trading pairs IMMEDIATELY (see §9)
5. Investigate root cause
6. Fix and re-run reconciliation
7. Resume only after 3 consecutive clean runs
```

---

## 6. Withdrawal Review & Processing Procedure

### Step 1: Review Queue

```
Every 4 hours, TREASURY role checks:
GET /admin/withdrawals/pending
```

### Step 2: Per-Withdrawal Review

For each pending withdrawal, verify:

```
[ ] User is KYC verified (kycStatus = 'verified')
[ ] Amount is within daily limits
[ ] Destination address is valid for the network
[ ] If new address: hold period (24h) has passed
[ ] Amount is not suspiciously large (> $1,000 for pilot)
[ ] User account is not flagged for investigation
```

### Step 3: Approve

```
TREASURY admin 1: POST /admin/withdrawals/{id}/approve
  Body: { "note": "Reviewed: KYC verified, amount within limits, address valid" }
```

### Step 4: Process (Different Admin)

```
TREASURY admin 2: POST /admin/withdrawals/{id}/process
  (Maker-checker enforced: must be different admin from approver)
```

### Step 5: Verify

```
Check withdrawal status = COMPLETED
Check txHash is present
Check user balance updated correctly
```

### Exception: Large Withdrawal (> $1,000)

```
1. TREASURY admin escalates to COMPLIANCE
2. COMPLIANCE reviews user's trading history and KYC docs
3. COMPLIANCE provides written approval or rejection
4. TREASURY processes with COMPLIANCE approval note
```

### Exception: Failed Withdrawal

```
1. Check custody provider dashboard for transaction status
2. If broadcast but not confirmed: wait 30 minutes, re-check
3. If never broadcast: recover funds via POST /admin/withdrawals/{id}/recover
4. Log incident and notify user
```

---

## 7. KYC Exception Handling

### User Cannot Complete KYC

```
1. User contacts support (email or ticket)
2. SUPPORT role verifies user identity manually
3. COMPLIANCE reviews case
4. If approved: COMPLIANCE proposes KYC override via governance
   POST /admin/governance/kyc/override
   Body: { userId, newStatus: "verified", reason: "Manual verification — [details]" }
5. Different COMPLIANCE/ADMIN approves the governance request
6. User notified via email
```

### KYC Rejection Appeal

```
1. User provides additional documentation
2. COMPLIANCE reviews new docs
3. If satisfied: KYC override as above
4. If not: maintain rejection, notify user with specific reason
```

### Suspicious KYC (Fraud Signals)

```
1. COMPLIANCE flags user for investigation
2. Freeze user account: UPDATE users SET is_active = false WHERE id = '...'
3. All pending withdrawals auto-blocked (AccountStatusGuard)
4. Investigate and document findings
5. Decision: unfreeze or permanent ban
6. All actions audit-logged
```

---

## 8. Incident Severity Matrix

| Severity | Condition | Response Time | Who | Action |
|----------|-----------|--------------|-----|--------|
| **SEV-1** | Reconciliation mismatch (negative balance, fee drift) | < 5 min | All on-call | Halt all trading. War room. |
| **SEV-1** | Suspected fund theft or unauthorized withdrawal | < 5 min | All on-call + legal | Halt everything. Preserve evidence. |
| **SEV-1** | Database compromise or data breach | < 5 min | All on-call + security | Halt everything. Rotate secrets. |
| **SEV-2** | Elevated 5xx rate on trading endpoints (> 1% for 5 min) | < 15 min | Engineering on-call | Investigate. May halt pair. |
| **SEV-2** | Withdrawal stuck in PROCESSING > 30 min | < 15 min | Treasury + Engineering | Check custody provider. |
| **SEV-2** | Missing fee_ledger entries detected | < 15 min | Engineering | Investigate. May halt pair. |
| **SEV-3** | Elevated WebSocket disconnects (> 50/min) | < 1 hour | Engineering | Investigate gateway. |
| **SEV-3** | Single user rate-limited repeatedly | < 1 hour | Engineering + Support | Check for abuse. |
| **SEV-4** | User reports UI issue | < 4 hours | Support + Engineering | Triage and fix. |

---

## 9. Halt / Rollback Criteria

### Pause Withdrawals

**When:** Suspicious withdrawal pattern, custody provider issue, or pending investigation.

```
How: Set all pending withdrawals to HOLD via admin panel
     OR: Temporarily disable the withdrawal endpoint at WAF level
Resume: After investigation complete and 2 consecutive clean reconciliation runs
```

### Halt Trading Pair

**When:** Reconciliation mismatch on that pair, matching engine error, or regulatory demand.

```
How: POST /admin/governance/pair/halt
     Body: { symbol: "BTC_USDT", reason: "[specific reason]" }
     → Requires second admin approval (unless emergency)
     → Emergency: POST /admin/governance/requests/{id}/emergency
Resume: After root cause fixed, tested, and 2 consecutive clean reconciliation runs
```

### Disable Deposits

**When:** Platform value approaching $10,000 limit, or suspected deposit exploit.

```
How: Set DEPOSIT_MONITOR_ENABLED=false (stops detection)
     AND/OR: Remove deposit addresses from monitoring
Resume: After clearing deposits or raising limit (with approval)
```

### Stop the Pilot

**When:** Any of the following:

```
IMMEDIATE HALT if:
  [ ] Reconciliation finds negative user balance
  [ ] Unauthorized fund movement detected
  [ ] Security breach confirmed or strongly suspected
  [ ] Regulatory demand received
  [ ] Cumulative losses > $500 from any cause

HALT WITHIN 1 HOUR if:
  [ ] 3+ SEV-2 incidents in 24 hours
  [ ] Reconciliation mismatch not resolved within 2 hours
  [ ] Custody provider down for > 2 hours
  [ ] On-call personnel unavailable (single point of failure)

Decision authority:
  - CTO can halt unilaterally
  - Any two senior on-call can halt jointly
  - COMPLIANCE can halt for regulatory reasons
```

**Halt procedure:**
```
1. Halt all trading pairs (governance emergency execute)
2. Pause all pending withdrawals
3. Disable deposit monitoring
4. Notify all pilot users (use template §10.5)
5. Preserve all logs and database state
6. Begin incident investigation
7. Do NOT resume without CTO + Security Lead approval
```

---

## 10. Communication Templates

### 10.1 Pilot Invitation

```
Subject: You're invited to the NovEx Private Pilot

Hi [Name],

You've been selected for the NovEx exchange private pilot. This is an early,
limited test of our platform with a small group of trusted users.

What to know:
- Web only: https://app.novex.io
- You'll need to complete identity verification (KYC) before trading
- Enable 2FA before making any withdrawals
- Trading pairs: BTC/USDT, ETH/USDT, SOL/USDT
- Daily withdrawal limit: $5,000

To get started:
1. Register at https://app.novex.io/register
2. Complete KYC verification
3. Deposit crypto to your NovEx wallet
4. Start trading!

Please report any issues to pilot-support@novex.io.

— The NovEx Team
```

### 10.2 KYC Issue Notice

```
Subject: Action Required: Identity Verification

Hi [Name],

We were unable to verify your identity automatically. Please contact us at
pilot-support@novex.io with your full name and a brief description of the issue.

Our compliance team will review your case within 24 hours.

— NovEx Support
```

### 10.3 Internal: Successful Launch

```
Channel: #novex-pilot-ops

🟢 Pilot Launch Successful

- First users registered: [count]
- First trade executed: [time]
- Reconciliation: PASSED (0 mismatches)
- All systems nominal

Next check: [time] (hourly recon + 4-hour review)
```

### 10.4 Internal: Daily Report

```
Channel: #novex-pilot-ops

📊 NovEx Pilot Daily Report — [date]

Users:     [total registered] / 50 max
Trades:    [count] ($[volume] volume)
Deposits:  [count] ($[amount])
Withdrawals: [count] ($[amount])
Fees collected: [BTC amount] BTC, [USDT amount] USDT
Reconciliation: [X] runs, [0] mismatches
Incidents: [count or "None"]
Platform value: $[total] / $10,000 max

Status: 🟢 Nominal / 🟡 Elevated / 🔴 Degraded
```

### 10.5 Pilot Pause Notice

```
Subject: NovEx Pilot Temporarily Paused

Hi [Name],

We've temporarily paused the NovEx pilot for a scheduled [maintenance/review].
Your funds are safe and all balances are preserved.

Trading and withdrawals are currently disabled. Deposits to existing addresses
will be credited when we resume.

We expect to resume within [timeframe]. We'll notify you when the platform
is back online.

If you have any concerns, contact pilot-support@novex.io.

— The NovEx Team
```

---

## 11. Accepted-Risk Register

| ID | Risk | Severity | Acceptance | Monitoring |
|---|------|----------|------------|------------|
| AR-1 | Access tokens valid for 15 min after logout | Medium | Token refresh + short TTL limits exposure window | Audit log review for post-logout activity |
| AR-2 | Tokens in localStorage (XSS-accessible) | Medium | Helmet CSP + React auto-escaping. Phase 2: httpOnly cookies | Monitor for XSS reports |
| AR-3 | 2FA verification is placeholder (any 6-digit code accepted) | Medium | Guard structure enforced. Real TOTP before production | Users told to enable 2FA; code format validated |
| AR-4 | Matching engine in-process (not extracted) | Low | Pilot scale < 50 users, < 100 orders/day | Monitor order latency p95 |
| AR-5 | Kafka connection unauthenticated | Low | VPC network isolation | Audit logs also persisted to DB |
| AR-6 | Custody provider is mock (sandbox) | Medium | Only testnet/small amounts at risk | Manual withdrawal review every 4 hours |
| AR-7 | No automated deposit sweep to cold wallet | Medium | Manual sweep when > $500 per asset | 4-hourly hot wallet balance check |

---

## 12. End-of-Day Reporting Template

Generate daily using admin panel data and reconciliation results.

```markdown
# NovEx Pilot Daily Report
Date: YYYY-MM-DD
Reporter: [name]

## Metrics
- Registered users: X / 50
- Active traders today: X
- Trades executed: X (volume: $X)
- Deposits: X ($X total)
- Withdrawals: X ($X total, X pending)
- Fees collected: X BTC, X USDT
- Platform total value: $X / $10,000

## Health
- Reconciliation runs: X, mismatches: X
- Error rate (5xx): X%
- Order latency p95: Xms
- WebSocket connections peak: X
- Incidents: X (details below)

## Incidents
1. [Time] [Severity] [Description] [Resolution]

## Withdrawal Queue
- Pending: X
- Processed today: X
- Rejected today: X
- Avg processing time: Xh

## Actions Taken
- [Any manual interventions, governance actions, or escalations]

## Tomorrow
- [ ] Any scheduled actions or reviews
```
