/**
 * Seed 47 additional trading pairs into PostgreSQL.
 *
 * Usage:  node scripts/seed-all-pairs.js
 */
const { Client } = require('pg');

const pairs = [
  { symbol: 'AAVEUSDT',   base: 'AAVE',   quote: 'USDT', pricePrecision: 2, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'ALGOUSDT',   base: 'ALGO',   quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'APEUSDT',    base: 'APE',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'APTUSDT',    base: 'APT',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'ARBUSDT',    base: 'ARB',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'ATOMUSDT',   base: 'ATOM',   quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'BNBUSDT',    base: 'BNB',    quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'COMPUSDT',   base: 'COMP',   quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'CRVUSDT',    base: 'CRV',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'DASHUSDT',   base: 'DASH',   quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'EOSUSDT',    base: 'EOS',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'ETCUSDT',    base: 'ETC',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'FILUSDT',    base: 'FIL',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'FTMUSDT',    base: 'FTM',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'GALAUSDT',   base: 'GALA',   quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'GMXUSDT',    base: 'GMX',    quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'GRTUSDT',    base: 'GRT',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'HBARUSDT',   base: 'HBAR',   quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'ICPUSDT',    base: 'ICP',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'IMXUSDT',    base: 'IMX',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'INJUSDT',    base: 'INJ',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'LDOUSDT',    base: 'LDO',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'LTCUSDT',    base: 'LTC',    quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'MANAUSDT',   base: 'MANA',   quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'MKRUSDT',    base: 'MKR',    quote: 'USDT', pricePrecision: 1, quantityPrecision: 4, minQuantity: '0.0001' },
  { symbol: 'NEARUSDT',   base: 'NEAR',   quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'OPUSDT',     base: 'OP',     quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'PEPEUSDT',   base: 'PEPE',   quote: 'USDT', pricePrecision: 8, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'QNTUSDT',    base: 'QNT',    quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'RENDERUSDT', base: 'RENDER', quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'RUNEUSDT',   base: 'RUNE',   quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'SANDUSDT',   base: 'SAND',   quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'SHIBUSDT',   base: 'SHIB',   quote: 'USDT', pricePrecision: 8, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'SNXUSDT',    base: 'SNX',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'STXUSDT',    base: 'STX',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'SUIUSDT',    base: 'SUI',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'SUSHIUSDT',  base: 'SUSHI',  quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'THETAUSDT',  base: 'THETA',  quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'TIAUSDT',    base: 'TIA',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'TRXUSDT',    base: 'TRX',    quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'VETUSDT',    base: 'VET',    quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'WLDUSDT',    base: 'WLD',    quote: 'USDT', pricePrecision: 3, quantityPrecision: 2, minQuantity: '0.01' },
  { symbol: 'XLMUSDT',    base: 'XLM',    quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
  { symbol: 'XTZUSDT',    base: 'XTZ',    quote: 'USDT', pricePrecision: 4, quantityPrecision: 1, minQuantity: '0.1' },
  { symbol: 'YFIUSDT',    base: 'YFI',    quote: 'USDT', pricePrecision: 1, quantityPrecision: 4, minQuantity: '0.0001' },
  { symbol: 'ZECUSDT',    base: 'ZEC',    quote: 'USDT', pricePrecision: 2, quantityPrecision: 3, minQuantity: '0.001' },
  { symbol: 'ZILUSDT',    base: 'ZIL',    quote: 'USDT', pricePrecision: 5, quantityPrecision: 0, minQuantity: '1' },
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

  let inserted = 0;
  for (const p of pairs) {
    const sql = `
      INSERT INTO trading_pairs (
        symbol, "baseCurrency", "quoteCurrency",
        "pricePrecision", "quantityPrecision", "minQuantity",
        "makerFee", "takerFee", max_quantity, min_notional,
        "isActive", stp_mode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (symbol) DO NOTHING
    `;
    const values = [
      p.symbol, p.base, p.quote,
      p.pricePrecision, p.quantityPrecision, p.minQuantity,
      '0.001', '0.001', '1000000', '10',
      true, 'cancel_taker',
    ];

    const result = await client.query(sql, values);
    if (result.rowCount > 0) {
      inserted++;
      console.log(`  Inserted: ${p.symbol}`);
    } else {
      console.log(`  Skipped (already exists): ${p.symbol}`);
    }
  }

  console.log(`\nInserted ${inserted} new pairs, skipped ${pairs.length - inserted} existing.`);

  const result = await client.query('SELECT symbol, "isActive" FROM trading_pairs ORDER BY symbol');
  console.log(`\nAll trading pairs (${result.rows.length} total):`);
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
