# NovEx — Known Findings (Self-Assessment)

These findings were identified during internal development before engaging the external auditor. They are documented here for transparency — the auditor should verify each one and may discover additional issues.

## Summary

| Severity | Count | Blocking Pilot? |
|----------|-------|:---:|
| Critical | 1 | Yes |
| High | 1 | Yes |
| Medium | 5 | 3 Yes, 2 Accepted Risk |
| Low | 2 | No |
| Info | 1 | No |

## Critical (must fix before any external access)

- **NVX-001:** JWT secret defaults to `change-me` if env var not set

## High (must fix before pilot)

- **NVX-002:** Database SSL disables certificate validation

## Medium (fix or accept before pilot)

- **NVX-003:** /metrics endpoint unauthenticated
- **NVX-004:** Access tokens not server-side revocable (15-min window)
- **NVX-005:** Tokens in localStorage (XSS risk)
- **NVX-006:** No 2FA on withdrawals
- **NVX-007:** No IP allowlist on admin endpoints

## Low (fix before production, not blocking pilot)

- **NVX-008:** Kafka no auth
- **NVX-009:** CORS open in dev mode

## Info (accepted by design)

- **NVX-010:** WebSocket public channels unauthenticated

## What the Auditor Should Look For Beyond These

We expect the auditor to independently discover and potentially add findings in areas including but not limited to:

1. Business logic vulnerabilities in trading/settlement
2. Race conditions we haven't tested
3. Input validation gaps
4. Authorization bypass paths we haven't considered
5. Cryptographic weaknesses
6. Infrastructure configuration issues
7. Dependency vulnerabilities
