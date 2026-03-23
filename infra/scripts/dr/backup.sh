#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# NovEx — PostgreSQL Backup Script
#
# Creates a point-in-time logical backup using pg_dump.
# Output: compressed SQL file with timestamp in the filename.
#
# Usage:
#   ./backup.sh                    # uses env vars or defaults
#   ./backup.sh /path/to/output    # custom output directory
#
# Env vars:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_DIR (default: ./backups)
#   BACKUP_RETENTION_DAYS (default: 30)
#
# For production (AWS RDS):
#   Use RDS automated snapshots + this script for logical backups.
#   RDS provides PITR (Point-In-Time Recovery) with 5-minute RPO.
# ──────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-novex}"
PGDATABASE="${PGDATABASE:-novex}"
BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="novex_backup_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# ── Pre-checks ───────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  echo "ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "╔══════════════════════════════════════════════╗"
echo "║  NovEx Database Backup                       ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Host:     ${PGHOST}:${PGPORT}"
echo "║  Database: ${PGDATABASE}"
echo "║  Output:   ${FILEPATH}"
echo "║  Time:     $(date -Iseconds)"
echo "╚══════════════════════════════════════════════╝"

# ── Backup ───────────────────────────────────────────────
echo "[1/4] Starting pg_dump..."

PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --verbose \
  2>"${BACKUP_DIR}/backup_${TIMESTAMP}.log" \
  | gzip > "${FILEPATH}"

BACKUP_SIZE=$(du -h "${FILEPATH}" | cut -f1)
echo "[2/4] Backup complete: ${FILEPATH} (${BACKUP_SIZE})"

# ── Integrity check ─────────────────────────────────────
echo "[3/4] Verifying backup integrity..."
if gzip -t "${FILEPATH}" 2>/dev/null; then
  echo "       ✓ Gzip integrity check passed"
else
  echo "ERROR: Backup file is corrupt!" >&2
  exit 1
fi

# ── Cleanup old backups ─────────────────────────────────
echo "[4/4] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "novex_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
REMAINING=$(find "${BACKUP_DIR}" -name "novex_backup_*.sql.gz" | wc -l)
echo "       ${REMAINING} backup(s) retained"

# ── Metadata file ────────────────────────────────────────
cat > "${BACKUP_DIR}/latest_backup.json" << EOF
{
  "filename": "${FILENAME}",
  "filepath": "${FILEPATH}",
  "database": "${PGDATABASE}",
  "host": "${PGHOST}",
  "timestamp": "$(date -Iseconds)",
  "size": "${BACKUP_SIZE}",
  "pg_dump_version": "$(pg_dump --version | head -1)"
}
EOF

echo ""
echo "✅ Backup complete: ${FILEPATH}"
echo ""
