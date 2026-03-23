#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# NovEx — Disaster Recovery End-to-End Test
#
# Exercises the full backup → restore → validate cycle
# against the local development database.
#
# Prerequisites:
#   - PostgreSQL running locally (Docker or native)
#   - Database 'novex' exists with seeded data
#   - pg_dump, psql, gunzip available
#
# Usage:
#   ./dr-test.sh
#
# What it does:
#   1. Backs up the 'novex' database
#   2. Restores into a fresh 'novex_dr_test' database
#   3. Runs all post-restore validation checks
#   4. Optionally runs the NestJS reconciliation suite
#   5. Reports pass/fail
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/dr_test_backups"

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-novex}"
export PGPASSWORD="${PGPASSWORD:-novex_dev}"
export PGDATABASE="novex"
export RESTORE_DB="novex_dr_test"
export BACKUP_DIR

echo "╔══════════════════════════════════════════════╗"
echo "║  NovEx Disaster Recovery Test                ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Source DB:  ${PGDATABASE}"
echo "║  Target DB:  ${RESTORE_DB}"
echo "║  Time:       $(date -Iseconds)"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Backup ───────────────────────────────────────
echo "━━━ Step 1: Backup ━━━"
bash "${SCRIPT_DIR}/backup.sh" "${BACKUP_DIR}"
BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/novex_backup_*.sql.gz | head -1)
echo ""

# ── Step 2: Restore to clean database ────────────────────
echo "━━━ Step 2: Restore ━━━"
bash "${SCRIPT_DIR}/restore.sh" "${BACKUP_FILE}"
echo ""

# ── Step 3: Validate ─────────────────────────────────────
echo "━━━ Step 3: Validate ━━━"
export PGDATABASE="${RESTORE_DB}"
bash "${SCRIPT_DIR}/validate-restore.sh"
VALIDATE_EXIT=$?
echo ""

# ── Step 4: Optional — Run NestJS reconciliation ─────────
echo "━━━ Step 4: Reconciliation (optional) ━━━"
BACKEND_DIR="${SCRIPT_DIR}/../../../packages/backend"
if [ -d "${BACKEND_DIR}" ] && command -v npx &>/dev/null; then
  echo "  Running reconciliation against restored database..."
  export DATABASE_HOST="${PGHOST}"
  export DATABASE_PORT="${PGPORT}"
  export DATABASE_USER="${PGUSER}"
  export DATABASE_PASSWORD="${PGPASSWORD}"
  export DATABASE_NAME="${RESTORE_DB}"

  # Run reconciliation test if available
  cd "${BACKEND_DIR}"
  npx jest --testPathPattern='reconciliation/__tests__' --verbose --runInBand 2>&1 | tail -20 || true
  echo ""
else
  echo "  Skipping (backend directory or npx not available)"
  echo ""
fi

# ── Step 5: Cleanup ──────────────────────────────────────
echo "━━━ Step 5: Cleanup ━━━"
export PGDATABASE="postgres"
PGPASSWORD="${PGPASSWORD}" psql \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="postgres" \
  -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";" 2>/dev/null || true
echo "  Dropped test database '${RESTORE_DB}'"
rm -rf "${BACKUP_DIR}"
echo "  Cleaned up test backups"
echo ""

# ── Result ───────────────────────────────────────────────
if [ "${VALIDATE_EXIT}" -eq 0 ]; then
  echo "╔══════════════════════════════════════════════╗"
  echo "║  ✅ DR TEST PASSED                           ║"
  echo "║                                              ║"
  echo "║  Backup → Restore → Validate: ALL CLEAR      ║"
  echo "╚══════════════════════════════════════════════╝"
  exit 0
else
  echo "╔══════════════════════════════════════════════╗"
  echo "║  ❌ DR TEST FAILED                           ║"
  echo "║                                              ║"
  echo "║  Validation checks failed after restore.     ║"
  echo "║  Investigate before relying on this backup.   ║"
  echo "╚══════════════════════════════════════════════╝"
  exit 1
fi
