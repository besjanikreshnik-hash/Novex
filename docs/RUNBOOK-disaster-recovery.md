# NovEx — Disaster Recovery Runbook

## RPO / RTO Targets

| Metric | Target | Mechanism |
|--------|--------|-----------|
| **RPO** (Recovery Point Objective) | 5 minutes | RDS continuous backup with PITR |
| **RTO** (Recovery Time Objective) | 30 minutes | Restore from snapshot + validation |
| **Logical backup RPO** | 1 hour | Hourly pg_dump via cron |
| **DR test frequency** | Monthly | Automated dr-test.sh |

### RPO Justification

- **RDS PITR** (production): Automated continuous backups allow point-in-time restore to within 5 minutes. This is the primary recovery mechanism.
- **Logical backups** (supplementary): Hourly pg_dump serves as a defense-in-depth measure against RDS-level failures or corruption that propagates to replicas.
- **Trade data**: Since the matching engine is in-memory, unfilled resting orders are lost on crash. Filled trades are persisted in the database and recovered. Unfilled order recovery requires replaying from the audit log.

### RTO Breakdown

| Step | Duration | Notes |
|------|----------|-------|
| Detect failure | 1–5 min | Monitoring alerts fire |
| Initiate restore | 2 min | Operator triggers from runbook |
| RDS PITR restore | 10–15 min | AWS creates new instance |
| Post-restore validation | 5 min | validate-restore.sh |
| Switch DNS/config | 2 min | Point backend at new instance |
| Smoke test | 5 min | Verify critical flows |
| **Total** | **~30 min** | |

## What Gets Backed Up

| Component | Backup Method | Frequency | Retention |
|-----------|--------------|-----------|-----------|
| PostgreSQL (all tables) | RDS automated snapshot | Continuous (PITR) | 30 days |
| PostgreSQL (logical) | pg_dump → S3 | Hourly (cron) | 30 days |
| Redis (cache) | Not backed up | — | Ephemeral by design |
| Kafka (events) | Topic retention | 7 days (native) | Self-healing |
| S3 (KYC docs) | S3 versioning | Automatic | 90 days |
| Secrets (KMS) | AWS Secrets Manager | Automatic | Versioned |
| Matching engine state | Not backed up | — | Rebuilt from open orders |

### What Is NOT Backed Up (and Why)

- **Redis**: Pure cache and rate-limit state. Rebuilt automatically on restart. No data loss.
- **Matching engine order book**: In-memory. On restart, open orders are loaded from the database and re-inserted into the book.
- **Kafka consumer offsets**: Managed by Kafka. Consumers replay from last committed offset.
- **WebSocket connections**: Clients reconnect automatically with backoff.

## Backup Scripts

### Logical Backup (pg_dump)

```bash
cd infra/scripts/dr

# Manual backup
./backup.sh

# Custom output directory
./backup.sh /mnt/backups

# Cron job (hourly)
0 * * * * cd /app/infra/scripts/dr && PGPASSWORD=xxx ./backup.sh /mnt/backups >> /var/log/novex-backup.log 2>&1
```

Output: `novex_backup_YYYYMMDD_HHMMSS.sql.gz` + `latest_backup.json` metadata.

### Production Backup (RDS)

```bash
# Manual RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier novex-production \
  --db-snapshot-identifier novex-manual-$(date +%Y%m%d-%H%M%S)

# Verify snapshot
aws rds describe-db-snapshots \
  --db-snapshot-identifier novex-manual-... \
  --query 'DBSnapshots[0].Status'
```

## Restore Procedure

### From Logical Backup

```bash
cd infra/scripts/dr

# Restore to a test database (non-destructive to production)
RESTORE_DB=novex_restored ./restore.sh backups/novex_backup_20260322_140000.sql.gz

# Validate the restored database
PGDATABASE=novex_restored ./validate-restore.sh

# If validation passes, swap databases:
psql -c "ALTER DATABASE novex RENAME TO novex_old;"
psql -c "ALTER DATABASE novex_restored RENAME TO novex;"
# Restart backend services
```

### From RDS PITR

```bash
# Restore to a specific point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier novex-production \
  --target-db-instance-identifier novex-restored \
  --restore-time "2026-03-22T14:00:00Z" \
  --db-instance-class db.r6g.large \
  --vpc-security-group-ids sg-xxxxx

# Wait for instance to become available
aws rds wait db-instance-available \
  --db-instance-identifier novex-restored

# Validate
PGHOST=novex-restored.xxxxx.rds.amazonaws.com \
  ./validate-restore.sh

# Swap DNS (Route 53) or update config
```

## Post-Restore Validation

The `validate-restore.sh` script runs 11 SQL-level invariant checks:

| # | Check | What It Catches |
|---|-------|-----------------|
| 1 | No negative available balances | Double-credit, settlement corruption |
| 2 | No negative locked balances | Lock/unlock corruption |
| 3 | No order overfills | Matching engine corruption |
| 4 | Fee ledger BTC = treasury BTC | Fee accounting drift |
| 5 | Fee ledger USDT = treasury USDT | Fee accounting drift |
| 6 | Trades have buyer fee_ledger entries | Partial settlement |
| 7 | Trades have seller fee_ledger entries | Partial settlement |
| 8 | Completed withdrawals have tx_hash | State machine violation |
| 9 | Credited deposits have credited_at | State machine violation |
| 10 | Orders reference valid users | Referential integrity |
| 11 | Wallets reference valid users | Referential integrity |

All checks must pass before promoting a restored database to production.

### Running the Full DR Test

```bash
cd infra/scripts/dr
./dr-test.sh
```

This script:
1. Backs up the local `novex` database
2. Restores into `novex_dr_test`
3. Runs all 11 validation checks
4. Optionally runs the NestJS reconciliation suite
5. Cleans up the test database
6. Reports pass/fail

## Operator Checklist

### Monthly DR Test

```
[ ] Schedule DR test window (off-peak)
[ ] Notify team
[ ] Run ./dr-test.sh against staging
[ ] Verify all 11 checks pass
[ ] Record results in incident log
[ ] If failures: investigate and fix, then re-test
[ ] Update this runbook if procedures changed
```

### Actual Disaster Recovery

```
[ ] INCIDENT: Database failure detected
[ ] Alert team via PagerDuty/Slack
[ ] Halt trading (set all pairs inactive via admin panel or direct DB)
[ ] Determine recovery point (latest clean backup or PITR timestamp)
[ ] Execute restore procedure (logical or RDS PITR)
[ ] Run validate-restore.sh — ALL CHECKS MUST PASS
[ ] Run NestJS reconciliation: npm run test:recon
[ ] If reconciliation finds mismatches: STOP and investigate
[ ] Point backend at restored database (update config or DNS)
[ ] Restart backend services
[ ] Verify WebSocket reconnects (check Grafana ws_active_connections)
[ ] Reopen trading (set pairs active)
[ ] Run smoke test: login → place order → verify fill → check balances
[ ] Monitor for 30 minutes (order latency, error rates, WS stability)
[ ] Conduct post-incident review within 48 hours
```

### Post-Restore: Matching Engine Recovery

After a database restore, the in-memory matching engine is empty. Open orders from the database need to be re-inserted:

```sql
-- Find open orders that need to be re-submitted to the engine
SELECT id, user_id, symbol, side, price, quantity,
       CAST(quantity AS DECIMAL) - CAST(filled_quantity AS DECIMAL) AS remaining
FROM orders
WHERE status IN ('open', 'partially_filled')
ORDER BY created_at ASC;
```

The backend should load these on startup. For now, this is a manual step. A future enhancement will automate order book reconstruction from the `orders` table on service startup.

## Backup Schedule (Production)

```
Continuous:   RDS automated backup (PITR, 30-day retention)
Hourly:       pg_dump to S3 (cron job)
Daily:        RDS manual snapshot (7-day retention as extra safety)
Monthly:      Full DR test (backup → restore → validate)
```

## S3 Backup Storage

```
s3://novex-backups/
  ├── hourly/
  │   ├── novex_backup_20260322_130000.sql.gz
  │   ├── novex_backup_20260322_140000.sql.gz
  │   └── ...
  ├── daily/
  │   └── novex_backup_20260322_000000.sql.gz
  └── metadata/
      └── latest_backup.json
```

Lifecycle policy: hourly backups deleted after 7 days, daily after 30 days.
