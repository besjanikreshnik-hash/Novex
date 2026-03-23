# NovEx — Controlled Pilot Go/No-Go Criteria

## Decision Framework

The controlled pilot launches when ALL of the following gates pass. Any single gate failure is a no-go.

## Gate 1: Zero Open Critical Findings

```
Condition: No finding with severity=Critical has status=Open or In Progress
Current:   NVX-001 (JWT secret) must be Fixed and Verified
Verified:  [ ]
```

## Gate 2: All High Findings Fixed or Accepted

```
Condition: All High-severity findings are either:
  - Fixed + Verified by auditor, OR
  - Formally accepted with documented compensating controls
Current:   NVX-002 (DB SSL) must be Fixed and Verified
Verified:  [ ]
```

## Gate 3: Pilot-Blocking Medium Findings Resolved

```
Condition: All Medium findings marked as "blocks pilot" are resolved
Required:
  [ ] NVX-003: /metrics endpoint secured
  [ ] NVX-006: 2FA on withdrawals implemented
  [ ] NVX-007: Admin IP allowlist active
  [ ] NVX-009: CORS production-only verified
Decision for NVX-004 (token revocation): [ ] Fixed  [ ] Accepted Risk (document)
Decision for NVX-005 (localStorage): [ ] Fixed  [ ] Accepted Risk (document)
```

## Gate 4: Reconciliation Passes

```
Condition: Full reconciliation run returns 0 mismatches
Run: npm run test:recon
Result: [ ] Pass  [ ] Fail
Date: __________
```

## Gate 5: Load Test Passes

```
Condition: All 19 load test scenarios pass with 0 reconciliation mismatches
Run: npm run test:load
Result: [ ] Pass  [ ] Fail
Date: __________
```

## Gate 6: DR Test Passes

```
Condition: Backup → Restore → Validate cycle completes with 0 failures
Run: infra/scripts/dr/dr-test.sh
Result: [ ] Pass  [ ] Fail
Date: __________
```

## Gate 7: External Auditor Sign-Off

```
Condition: External auditor has:
  - Completed pentest (62 test cases)
  - Verified all Critical/High remediations
  - Signed the sign-off checklist (all 7 domains)
  - Issued a findings report with no open Critical/High
Auditor: __________
Date: __________
```

## Gate 8: Dependency Security

```
Condition:
  [ ] npm audit shows 0 critical vulnerabilities
  [ ] Trivy container scan shows 0 critical vulnerabilities
  [ ] No known CVEs in production dependencies
Date: __________
```

## Gate 9: Production Environment Hardened

```
Condition:
  [ ] JWT_SECRET is unique, ≥64 chars, stored in Secrets Manager
  [ ] DATABASE_SSL=true with rejectUnauthorized=true
  [ ] NODE_ENV=production
  [ ] CORS restricted to production domain
  [ ] Admin endpoints IP-restricted
  [ ] /metrics endpoint authenticated
  [ ] Kafka using IAM auth (or not exposed)
  [ ] RDS automated backups enabled with PITR
  [ ] WAF rules active
  [ ] DDoS protection enabled (Shield)
Date: __________
```

## Gate 10: Operational Readiness

```
Condition:
  [ ] On-call rotation established (≥2 people)
  [ ] Incident response runbook reviewed
  [ ] Monitoring dashboards accessible
  [ ] Alert rules firing correctly (test alert verified)
  [ ] Reconciliation scheduled (hourly)
  [ ] DR procedure documented and tested
  [ ] Rollback procedure documented
Date: __________
```

## Decision

| Gate | Status | Blocker? |
|------|--------|----------|
| 1. Zero Critical | | |
| 2. High resolved | | |
| 3. Medium resolved | | |
| 4. Recon passes | | |
| 5. Load test passes | | |
| 6. DR test passes | | |
| 7. Auditor sign-off | | |
| 8. Dependency security | | |
| 9. Environment hardened | | |
| 10. Ops readiness | | |

### Decision

```
[ ] GO — All gates pass. Proceed with controlled pilot.
[ ] NO-GO — One or more gates failed. Address blockers and re-evaluate.
```

| Role | Decision | Signature | Date |
|------|----------|-----------|------|
| CTO | | | |
| Security Lead | | | |
| External Auditor | | | |

### Pilot Constraints (if GO)

- Maximum 50 invited users
- Maximum $10,000 total platform value
- 24/7 monitoring for first 72 hours
- Daily reconciliation review
- Immediate halt capability (pair halt via governance)
- Weekly security review for first month
