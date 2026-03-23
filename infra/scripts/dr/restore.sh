#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# NovEx — PostgreSQL Restore Script
#
# Restores a backup into a target database.
# DESTRUCTIVE: drops and recreates the target database.
#
# Usage:
#   ./restore.sh <backup_file.sql.gz>
#   ./restore.sh backups/novex_backup_20260322_140000.sql.gz
#
# Env vars:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD
#   RESTORE_DB (default: novex_restored)
# ──────────────────────────────────────────────────────────
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-novex}"
RESTORE_DB="${RESTORE_DB:-novex_restored}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "╔══════════════════════════════════════════════╗"
echo "║  NovEx Database Restore                      ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Source:   ${BACKUP_FILE}"
echo "║  Target:   ${RESTORE_DB}@${PGHOST}:${PGPORT}"
echo "║  Time:     $(date -Iseconds)"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "⚠️  This will DROP and recreate database '${RESTORE_DB}'."
echo "    Press Ctrl+C within 5 seconds to abort."
sleep 5

# ── Drop and recreate target database ────────────────────
echo "[1/5] Dropping existing database '${RESTORE_DB}' (if exists)..."
PGPASSWORD="${PGPASSWORD:-}" psql \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="postgres" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${RESTORE_DB}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

PGPASSWORD="${PGPASSWORD:-}" psql \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="postgres" \
  -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";"

echo "[2/5] Creating fresh database '${RESTORE_DB}'..."
PGPASSWORD="${PGPASSWORD:-}" psql \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="postgres" \
  -c "CREATE DATABASE \"${RESTORE_DB}\";"

# ── Restore backup ──────────────────────────────────────
echo "[3/5] Restoring from ${BACKUP_FILE}..."
RESTORE_START=$(date +%s)

gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${PGPASSWORD:-}" psql \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="${RESTORE_DB}" \
  --set ON_ERROR_STOP=on \
  -q

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
echo "       Restore completed in ${RESTORE_DURATION} seconds"

# ── Verify table counts ─────────────────────────────────
echo "[4/5] Verifying restored tables..."
TABLE_COUNT=$(PGPASSWORD="${PGPASSWORD:-}" psql \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="${RESTORE_DB}" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "       ${TABLE_COUNT} tables found"

# Print row counts for critical tables
echo ""
echo "  Table row counts:"
for TABLE in users wallets orders trades fee_ledger deposits withdrawals audit_logs reconciliation_runs; do
  COUNT=$(PGPASSWORD="${PGPASSWORD:-}" psql \
    --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
    --dbname="${RESTORE_DB}" -t -c \
    "SELECT count(*) FROM \"${TABLE}\";" 2>/dev/null || echo "  (table not found)")
  printf "    %-25s %s\n" "${TABLE}" "${COUNT}"
done

# ── Generate checksum ────────────────────────────────────
echo ""
echo "[5/5] Computing data checksums for critical tables..."
for TABLE in wallets trades fee_ledger; do
  CHECKSUM=$(PGPASSWORD="${PGPASSWORD:-}" psql \
    --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
    --dbname="${RESTORE_DB}" -t -c \
    "SELECT md5(string_agg(t::text, '' ORDER BY id)) FROM \"${TABLE}\" t;" 2>/dev/null || echo "n/a")
  printf "    %-25s md5=%s\n" "${TABLE}" "${CHECKSUM}"
done

echo ""
echo "✅ Restore complete: ${RESTORE_DB}"
echo "   Duration: ${RESTORE_DURATION}s"
echo ""
echo "Next steps:"
echo "  1. Run post-restore validation: ./validate-restore.sh"
echo "  2. Point the backend at RESTORE_DB to verify"
echo "  3. If valid, rename to production database"
