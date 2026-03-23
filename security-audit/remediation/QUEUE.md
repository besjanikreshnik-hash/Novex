# NovEx — Remediation Queue

Ordered by: severity first, then pilot-blocking status, then effort.

## Sprint 1: Pilot Blockers (Week 1)

| Priority | Finding | Effort | Owner | Blocks Pilot |
|:---:|---------|--------|-------|:---:|
| 1 | NVX-001: JWT secret fail-fast | 2h | Backend | Yes |
| 2 | NVX-002: DB SSL with proper CA | 4h | Infra | Yes |
| 3 | NVX-006: 2FA on withdrawals | 8h | Backend | Yes |
| 4 | NVX-003: /metrics auth | 2h | Infra | Yes |
| 5 | NVX-007: Admin IP allowlist | 4h | Infra | Yes |
| 6 | NVX-009: CORS env check | 1h | DevOps | Yes |

**Sprint 1 total: ~21 hours**

## Sprint 2: Hardening (Week 2)

| Priority | Finding | Effort | Owner | Blocks Pilot |
|:---:|---------|--------|-------|:---:|
| 7 | NVX-004: Token revocation (Redis blacklist or reduced TTL) | 8h | Backend | Decision |
| 8 | NVX-005: Token storage (httpOnly cookies or accept risk) | 8h | Frontend | Decision |
| 9 | Dependency audit: `npm audit` + Trivy scan | 4h | DevOps | Review |
| 10 | Add CSP headers tightening | 4h | Frontend | No |

**Sprint 2 total: ~24 hours**

## Sprint 3: Pre-Production (Week 3-4)

| Priority | Finding | Effort | Owner | Blocks Prod |
|:---:|---------|--------|-------|:---:|
| 11 | NVX-008: Kafka IAM auth | 4h | Infra | Yes |
| 12 | Implement TOTP 2FA for admin logins | 16h | Backend | Yes |
| 13 | Add session concurrency limits | 8h | Backend | No |
| 14 | Security response headers audit | 4h | Backend | No |
| 15 | Pen test re-test (auditor verifies all fixes) | External | — | Yes |

## Remediation Timeline

```
Week 1: Sprint 1 (pilot blockers) → fixes deployed to staging
Week 2: Sprint 2 (hardening) + auditor re-verification of Sprint 1
Week 3: Sprint 3 (pre-prod) + auditor final sign-off
Week 4: Go/no-go decision → controlled pilot launch
```

## After Each Fix

```
[ ] Fix implemented in code
[ ] Unit/integration test added proving the fix
[ ] Deployed to staging
[ ] Manually verified on staging
[ ] Finding status updated in TRACKER.md → "Fixed"
[ ] Auditor re-tests → status updated to "Verified"
```
