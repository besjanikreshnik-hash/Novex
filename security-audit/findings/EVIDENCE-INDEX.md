# NovEx — Evidence Index

Evidence files are stored in `security-audit/evidence/`. This index maps findings to their supporting evidence.

## Template

```
Finding ID: NVX-XXX
Evidence Type: screenshot / log / PoC script / code snippet / curl command
Filename: evidence/NVX-XXX-description.{png,txt,sh}
Description: What the evidence shows
Captured By: auditor name
Date: YYYY-MM-DD
```

## Evidence Log

### NVX-001: JWT default secret

| Field | Value |
|-------|-------|
| Evidence Type | Code snippet |
| File | `packages/backend/src/config/configuration.ts:11` |
| Description | Line shows `secret: process.env.JWT_SECRET ?? 'change-me'` |
| Date | Pre-assessment |

### NVX-002: Database SSL

| Field | Value |
|-------|-------|
| Evidence Type | Code snippet |
| File | `packages/backend/src/app.module.ts:48-50` |
| Description | SSL config shows `rejectUnauthorized: false` |
| Date | Pre-assessment |

### NVX-003: /metrics unauthenticated

| Field | Value |
|-------|-------|
| Evidence Type | curl command |
| Command | `curl -s http://localhost:3000/metrics \| head -5` |
| Description | Returns Prometheus metrics without any auth header |
| Date | Pre-assessment |

---

*Auditor: add new evidence entries below, placing files in the evidence/ directory.*
