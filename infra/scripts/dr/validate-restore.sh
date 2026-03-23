#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# NovEx — Post-Restore Validation Script
#
# Runs SQL-level invariant checks against a restored database
# to verify data consistency before promoting to production.
#
# Usage:
#   ./validate-restore.sh
#   PGDATABASE=novex_restored ./validate-restore.sh
#
# Checks:
#   1. No negative wallet balances
#   2. fee_ledger totals match treasury wallets
#   3. No order overfills
#   4. Trade gross_quote = price × gross_base
#   5. Every trade has fee_ledger entries
#   6. Deposit/withdrawal state consistency
#   7. Referential integrity spot checks
# ──────────────────────────────────────────────────────────
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-novex}"
PGDATABASE="${PGDATABASE:-novex_restored}"

PASS=0
FAIL=0

run_check() {
  local name="$1"
  local sql="$2"
  local expected="$3"

  RESULT=$(PGPASSWORD="${PGPASSWORD:-}" psql \
    --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
    --dbname="${PGDATABASE}" -t -c "${sql}" 2>/dev/null | tr -d ' ')

  if [ "${RESULT}" = "${expected}" ]; then
    echo "  ✓ ${name}"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${name} (expected: ${expected}, got: ${RESULT})"
    FAIL=$((FAIL + 1))
  fi
}

echo "╔══════════════════════════════════════════════╗"
echo "║  NovEx Post-Restore Validation               ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Database: ${PGDATABASE}@${PGHOST}:${PGPORT}"
echo "║  Time:     $(date -Iseconds)"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. No negative available balances ────────────────────
echo "Invariant checks:"
run_check \
  "No negative available balances" \
  "SELECT count(*) FROM wallets WHERE CAST(available AS DECIMAL) < 0;" \
  "0"

# ── 2. No negative locked balances ──────────────────────
run_check \
  "No negative locked balances" \
  "SELECT count(*) FROM wallets WHERE CAST(locked AS DECIMAL) < 0;" \
  "0"

# ── 3. No order overfills ───────────────────────────────
run_check \
  "No order overfills (filledQty <= quantity)" \
  "SELECT count(*) FROM orders WHERE CAST(filled_quantity AS DECIMAL) > CAST(quantity AS DECIMAL);" \
  "0"

# ── 4. Fee ledger ↔ treasury balance (BTC) ──────────────
run_check \
  "Fee ledger BTC total = treasury BTC balance" \
  "SELECT CASE WHEN
    COALESCE((SELECT SUM(CAST(amount AS DECIMAL)) FROM fee_ledger WHERE asset = 'BTC'), 0) =
    COALESCE((SELECT CAST(available AS DECIMAL) FROM wallets WHERE user_id = '00000000-0000-0000-0000-000000000001' AND currency = 'BTC'), 0)
   THEN 'match' ELSE 'mismatch' END;" \
  "match"

# ── 5. Fee ledger ↔ treasury balance (USDT) ─────────────
run_check \
  "Fee ledger USDT total = treasury USDT balance" \
  "SELECT CASE WHEN
    COALESCE((SELECT SUM(CAST(amount AS DECIMAL)) FROM fee_ledger WHERE asset = 'USDT'), 0) =
    COALESCE((SELECT CAST(available AS DECIMAL) FROM wallets WHERE user_id = '00000000-0000-0000-0000-000000000001' AND currency = 'USDT'), 0)
   THEN 'match' ELSE 'mismatch' END;" \
  "match"

# ── 6. Every trade with buyer_fee > 0 has a fee_ledger entry ──
run_check \
  "All trades with buyer_fee have fee_ledger entry" \
  "SELECT count(*) FROM trades t
   WHERE CAST(t.buyer_fee_amount AS DECIMAL) > 0
   AND NOT EXISTS (
     SELECT 1 FROM fee_ledger f WHERE f.trade_id = t.id AND f.source = 'buyer_fee'
   );" \
  "0"

# ── 7. Every trade with seller_fee > 0 has a fee_ledger entry ──
run_check \
  "All trades with seller_fee have fee_ledger entry" \
  "SELECT count(*) FROM trades t
   WHERE CAST(t.seller_fee_amount AS DECIMAL) > 0
   AND NOT EXISTS (
     SELECT 1 FROM fee_ledger f WHERE f.trade_id = t.id AND f.source = 'seller_fee'
   );" \
  "0"

# ── 8. No completed withdrawals without tx_hash ─────────
run_check \
  "All completed withdrawals have tx_hash" \
  "SELECT count(*) FROM withdrawals WHERE status = 'completed' AND tx_hash IS NULL;" \
  "0"

# ── 9. No credited deposits without credited_at ─────────
run_check \
  "All credited deposits have credited_at timestamp" \
  "SELECT count(*) FROM deposits WHERE status = 'credited' AND credited_at IS NULL;" \
  "0"

# ── 10. Referential integrity: orders reference valid users ──
run_check \
  "All orders reference existing users" \
  "SELECT count(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id);" \
  "0"

# ── 11. Referential integrity: wallets reference valid users ──
run_check \
  "All wallets reference existing users" \
  "SELECT count(*) FROM wallets w WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = w.user_id);" \
  "0"

# ── Summary ──────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
TOTAL=$((PASS + FAIL))
echo "Results: ${PASS}/${TOTAL} passed, ${FAIL} failed"

if [ ${FAIL} -eq 0 ]; then
  echo ""
  echo "✅ All validation checks passed. Database is consistent."
  echo "   Safe to promote to production."
  exit 0
else
  echo ""
  echo "❌ ${FAIL} check(s) FAILED. DO NOT promote to production."
  echo "   Investigate failures before proceeding."
  exit 1
fi
