/**
 * Seed additional trading pairs into PostgreSQL.
 *
 * Usage:  node scripts/seed-trading-pairs.js
 */
const { Client } = require('pg');

const pairs = [
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'ADAUSDT',  base: 'ADA',  quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '1' },
  { symbol: 'DOTUSDT',  base: 'DOT',  quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.1' },
  { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.1' },
  { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.1' },
  { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '1' },
  { symbol: 'UNIUSDT',  base: 'UNI',  quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.1' },
  { symbol: 'XRPUSDT',  base: 'XRP',  quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '1' },
];

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'novex',
    password: 'novex_dev',
    database: 'novex',
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  for (const p of pairs) {
    const sql = `
      INSERT INTO trading_pairs (
        symbol, "baseCurrency", "quoteCurrency",
        "pricePrecision", "quantityPrecision", "minQuantity",
        "makerFee", "takerFee", max_quantity, min_notional,
        "isActive", stp_mode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (symbol) DO UPDATE SET
        "pricePrecision" = EXCLUDED."pricePrecision",
        "quantityPrecision" = EXCLUDED."quantityPrecision",
        "minQuantity" = EXCLUDED."minQuantity",
        "isActive" = EXCLUDED."isActive"
    `;
    const values = [
      p.symbol, p.base, p.quote,
      p.pricePrecision, p.quantityPrecision, p.minQuantity,
      '0.001', '0.001', '1000000', '10',
      true, 'cancel_taker',
    ];

    await client.query(sql, values);
    console.log(`Upserted: ${p.symbol}`);
  }

  const result = await client.query('SELECT symbol, "isActive" FROM trading_pairs ORDER BY symbol');
  console.log('\nAll trading pairs:');
  for (const row of result.rows) {
    console.log(`  ${row.symbol} (active: ${row.isActive})`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
