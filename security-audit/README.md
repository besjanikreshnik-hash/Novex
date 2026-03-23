# NovEx Security Audit Workspace

This directory is the single point of entry for the independent security assessment. It contains everything an auditor needs to understand, test, and report on the NovEx platform.

## Directory Structure

```
security-audit/
├── README.md                     ← You are here
├── architecture/
│   └── REVIEW-PACKAGE.md         ← System architecture, auth model, data flows
├── findings/
│   ├── TRACKER.md                ← All findings with severity, status, owner
│   ├── KNOWN-FINDINGS.md         ← Pre-identified issues (self-assessment)
│   └── EVIDENCE-INDEX.md         ← Index of supporting evidence per finding
├── evidence/
│   └── (auditor places screenshots, logs, PoC scripts here)
├── environment/
│   └── SETUP.md                  ← How to stand up the test environment
├── remediation/
│   ├── PLAYBOOK.md               ← Fix procedures for Critical/High findings
│   └── QUEUE.md                  ← Prioritized remediation order
└── sign-off/
    ├── CHECKLIST.md              ← Per-domain security sign-off
    └── GO-NO-GO.md               ← Pilot launch criteria
```

## For the Auditor

1. Start with `environment/SETUP.md` to get a local instance running
2. Read `architecture/REVIEW-PACKAGE.md` for system understanding
3. Use the pentest checklist in `docs/SECURITY-pentest-checklist.md` as your test plan
4. Record findings in `findings/TRACKER.md` format
5. Place evidence in `evidence/` directory

## For the NovEx Team

1. Monitor `findings/TRACKER.md` for new entries
2. Follow `remediation/PLAYBOOK.md` for fix procedures
3. Work through `remediation/QUEUE.md` in priority order
4. Complete `sign-off/CHECKLIST.md` after remediation
5. Review `sign-off/GO-NO-GO.md` before pilot launch decision

## Referenced Documents (in docs/)

- `SECURITY-review-package.md` — Full architecture and auth model
- `SECURITY-threat-model.md` — 20 threats with trust boundaries
- `SECURITY-pentest-checklist.md` — 62 test cases across 9 categories
- `DESIGN-fee-model-and-stp.md` — Fee accounting model
- `DESIGN-idempotency-and-concurrency.md` — Concurrency hardening
- `DESIGN-custody-signing.md` — Withdrawal signing architecture
- `DESIGN-governance-matrix.md` — Admin RBAC and governance
- `DESIGN-reconciliation.md` — Accounting invariant checks
- `RUNBOOK-disaster-recovery.md` — Backup/restore/DR
- `DESIGN-production-hardening.md` — Rate limiting, funding, KYC gating
