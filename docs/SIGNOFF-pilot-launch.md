# NovEx Web-Only Controlled Pilot Launch Sign-Off

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Date** | _________________________ |
| **Environment** | Production (`app.novex.io`) |
| **Backend Release** | Git SHA: `________________________` |
| **Web Release** | Git SHA: `________________________` |
| **Migration Version** | `1700000000009-GovernanceAndRoles` |
| **Runbook Version** | `RUNBOOK-pilot-operations.md v1.0` |

---

## 1. Pilot Scope

| Constraint | Value |
|-----------|-------|
| Platform | Web only |
| Access | Invited users only |
| Maximum users | 50 |
| Maximum platform value | $10,000 |
| Trading pairs | BTC/USDT, ETH/USDT, SOL/USDT |
| Monitoring | 24/7 for first 72 hours |
| Reconciliation | Hourly (automated) |
| Withdrawal daily limit | $5,000 per verified user |
| Mobile | Excluded |
| Browser extension | Excluded |

---

## 2. Preconditions Confirmed

| # | Precondition | Owner | Status |
|---|-------------|-------|--------|
| 1 | Production environment validated and healthy | Infra | [ ] |
| 2 | JWT secret hardened (64+ chars, fail-fast on default) | Backend | [ ] |
| 3 | DB SSL enabled with CA validation (`rejectUnauthorized: true`) | Infra | [ ] |
| 4 | `/metrics` protected by METRICS_TOKEN | Infra | [ ] |
| 5 | `/admin/metrics` requires admin JWT | Backend | [ ] |
| 6 | ADMIN_IP_ALLOWLIST configured and verified | Infra | [ ] |
| 7 | 2FA required for withdrawal requests (TwoFactorGuard) | Backend | [ ] |
| 8 | Grafana dashboards live with real data | Infra | [ ] |
| 9 | Alert rules firing (test alert verified) | Infra | [ ] |
| 10 | Reconciliation scheduler active (hourly cron) | Infra | [ ] |
| 11 | DR test passed within last 7 days | Infra | [ ] |
| 12 | Load test passed (19 scenarios, 0 mismatches) | QA | [ ] |
| 13 | Funding integration tests passed | QA | [ ] |
| 14 | Custody pipeline tests passed | QA | [ ] |
| 15 | Web E2E tests passed (Playwright, 10 scenarios) | QA | [ ] |
| 16 | KYC provider sandbox verified | Backend | [ ] |
| 17 | Blockchain provider sandbox verified | Backend | [ ] |
| 18 | Rollback procedure documented and tested | Infra | [ ] |
| 19 | On-call roster confirmed (§8 below) | Ops | [ ] |
| 20 | Pilot operations runbook reviewed by all on-call | Ops | [ ] |

---

## 3. Accepted Risks

| Risk | Severity | Accepted By | Monitoring | Escalation Trigger |
|------|----------|------------|------------|-------------------|
| Access tokens valid up to 15 min after logout (not server-revocable) | Medium | _____________ | Audit log review for post-logout activity | Unauthorized trade detected after logout event |
| Tokens stored in localStorage (XSS-accessible) | Medium | _____________ | CSP headers active via Helmet; React auto-escaping | Any XSS report or DOM injection detected |
| 2FA verification accepts any 6-digit code (placeholder TOTP) | Medium | _____________ | Guard structure enforced; code format validated | User reports accepting wrong code; or pre-production TOTP integration replaces placeholder |
| Matching engine runs in-process (not extracted) | Low | _____________ | Order latency p95 dashboard | p95 > 500ms sustained for 5 minutes |
| Kafka connection unauthenticated | Low | _____________ | VPC network isolation; audit also persists to DB | Unexpected messages on Kafka topic |
| Mobile app not wired to real API | Low | _____________ | Mobile not deployed; web-only pilot | N/A during pilot |
| Browser extension not pilot-ready | Low | _____________ | Extension not deployed | N/A during pilot |

---

## 4. Go / No-Go Gates

All gates must be TRUE for GO decision.

| Gate | Condition | Status |
|------|-----------|--------|
| G1 | Zero open Critical security findings | [ ] |
| G2 | All High findings fixed and verified | [ ] |
| G3 | All pilot-blocking Medium findings resolved or accepted | [ ] |
| G4 | Last reconciliation run: 0 mismatches | [ ] |
| G5 | No active SEV-1 or SEV-2 incident | [ ] |
| G6 | Monitoring dashboards confirmed live | [ ] |
| G7 | Alert rules confirmed firing | [ ] |
| G8 | On-call roster confirmed with ≥ 2 people | [ ] |
| G9 | All preconditions in §2 checked | [ ] |
| G10 | All sign-offs in §9 complete | [ ] |

---

## 5. Rollback / Halt Criteria

### Halt All Trading

- [ ] Reconciliation mismatch with negative balance detected
- [ ] Order overfill detected (filledQuantity > quantity)
- [ ] Fee ledger / treasury drift detected
- [ ] Matching engine producing incorrect results

**How:** Governance emergency pair halt or direct DB update: `UPDATE trading_pairs SET is_active = false`

### Pause Withdrawals

- [ ] Custody provider outage > 2 hours
- [ ] Withdrawal stuck in PROCESSING > 30 minutes with no txHash
- [ ] Suspicious withdrawal pattern flagged by compliance

**How:** Admin sets pending withdrawals to HOLD; or WAF blocks withdrawal endpoint

### Disable Deposits

- [ ] Platform total value approaching $10,000 cap
- [ ] Suspected deposit exploit (duplicate crediting)
- [ ] Blockchain provider reporting incorrect data

**How:** Set `DEPOSIT_MONITOR_ENABLED=false` and restart deposit monitor

### Stop Entire Pilot

- [ ] Cumulative losses from any cause > $500
- [ ] 3+ SEV-2 incidents within 24 hours
- [ ] Reconciliation mismatch not resolved within 2 hours
- [ ] Regulatory demand received
- [ ] Suspected security breach or unauthorized fund movement
- [ ] On-call personnel unavailable (single point of failure)

**How:** Halt all pairs + pause withdrawals + disable deposits + notify users (template in runbook §10.5)

---

## 6. Decision Authority

| Action | Primary Authority | Backup Authority |
|--------|------------------|-----------------|
| Halt all trading | CTO | Any two senior on-call jointly |
| Pause withdrawals | Treasury Lead | CTO |
| Disable deposits | Engineering Lead | CTO |
| Stop entire pilot | CTO (unilateral) | Any two: Engineering + Compliance jointly |
| Resume operations after halt | CTO + Security Lead (both required) | — |
| Approve new pilot users (above 50) | CTO | — |

---

## 7. On-Call Roster

| Role | Name | Contact | Backup |
|------|------|---------|--------|
| Engineering On-Call | _____________ | _____________ | _____________ |
| Treasury / Ops On-Call | _____________ | _____________ | _____________ |
| Compliance On-Call | _____________ | _____________ | _____________ |
| Incident Commander | _____________ | _____________ | _____________ |
| Executive Approver | _____________ | _____________ | _____________ |

**Primary channel:** _________________________

**Escalation path:** On-call → Incident Commander → Executive Approver

---

## 8. Final Approval

### Engineering Lead

| Field | Value |
|-------|-------|
| Name | _________________________________ |
| Title | _________________________________ |
| Signature | _________________________________ |
| Date/Time | _________________________________ |
| Decision | [ ] **GO** · [ ] **NO-GO** |

### Treasury / Ops Lead

| Field | Value |
|-------|-------|
| Name | _________________________________ |
| Title | _________________________________ |
| Signature | _________________________________ |
| Date/Time | _________________________________ |
| Decision | [ ] **GO** · [ ] **NO-GO** |

### Compliance Lead

| Field | Value |
|-------|-------|
| Name | _________________________________ |
| Title | _________________________________ |
| Signature | _________________________________ |
| Date/Time | _________________________________ |
| Decision | [ ] **GO** · [ ] **NO-GO** |

### Incident Commander

| Field | Value |
|-------|-------|
| Name | _________________________________ |
| Title | _________________________________ |
| Signature | _________________________________ |
| Date/Time | _________________________________ |
| Decision | [ ] **GO** · [ ] **NO-GO** |

### Executive Approver

| Field | Value |
|-------|-------|
| Name | _________________________________ |
| Title | _________________________________ |
| Signature | _________________________________ |
| Date/Time | _________________________________ |
| Decision | [ ] **GO** · [ ] **NO-GO** |

---

## 9. Launch Record

| Field | Value |
|-------|-------|
| Actual launch time | _________________________________ |
| Launched by | _________________________________ |
| First user admitted | _________________________________ |
| Monitoring start time | _________________________________ |
| First reconciliation completed | _________________________________ |
| First trade executed | _________________________________ |
| Launch notes | _________________________________ |
| | _________________________________ |
| | _________________________________ |
