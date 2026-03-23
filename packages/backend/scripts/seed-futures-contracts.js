/**
 * Seed perpetual futures contracts into PostgreSQL.
 *
 * Usage:  node scripts/seed-futures-contracts.js
 */
const { Client } = require('pg');

const contracts = [
  {
    symbol: 'BTCUSDT',
    base_asset: 'BTC',
    quote_asset: 'USDT',
    contract_type: 'perpetual',
    max_leverage: 125,
    maintenance_margin_rate: '0.004',
    taker_fee: '0.0004',
    maker_fee: '0.0002',
    mark_price: '65000',
    index_price: '65000',
    funding_rate: '0.0001',
  },
  {
    symbol: 'ETHUSDT',
    base_asset: 'ETH',
    quote_asset: 'USDT',
    contract_type: 'perpetual',
    max_leverage: 100,
    maintenance_margin_rate: '0.005',
    taker_fee: '0.0004',
    maker_fee: '0.0002',
    mark_price: '3500',
    index_price: '3500',
    funding_rate: '0.0001',
  },
  {
    symbol: 'SOLUSDT',
    base_asset: 'SOL',
    quote_asset: 'USDT',
    contract_type: 'perpetual',
    max_leverage: 50,
    maintenance_margin_rate: '0.006',
    taker_fee: '0.0005',
    maker_fee: '0.0002',
    mark_price: '145',
    index_price: '145',
    funding_rate: '0.0001',
  },
  {
    symbol: 'BNBUSDT',
    base_asset: 'BNB',
    quote_asset: 'USDT',
    contract_type: 'perpetual',
    max_leverage: 50,
    maintenance_margin_rate: '0.006',
    taker_fee: '0.0005',
    maker_fee: '0.0002',
    mark_price: '600',
    index_price: '600',
    funding_rate: '0.0001',
  },
  {
    symbol: 'XRPUSDT',
    base_asset: 'XRP',
    quote_asset: 'USDT',
    contract_type: 'perpetual',
    max_leverage: 50,
    maintenance_margin_rate: '0.006',
    taker_fee: '0.0005',
    maker_fee: '0.0002',
    mark_price: '0.62',
    index_price: '0.62',
    funding_rate: '0.0001',
  },
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

  for (const c of contracts) {
    const sql = `
      INSERT INTO futures_contracts (
        symbol, base_asset, quote_asset, contract_type,
        max_leverage, maintenance_margin_rate, taker_fee, maker_fee,
        mark_price, index_price, funding_rate, is_active,
        next_funding_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (symbol) DO UPDATE SET
        max_leverage = EXCLUDED.max_leverage,
        mark_price = EXCLUDED.mark_price,
        index_price = EXCLUDED.index_price,
        is_active = EXCLUDED.is_active
    `;
    const nextFunding = new Date();
    nextFunding.setHours(nextFunding.getHours() + 8);

    const values = [
      c.symbol, c.base_asset, c.quote_asset, c.contract_type,
      c.max_leverage, c.maintenance_margin_rate, c.taker_fee, c.maker_fee,
      c.mark_price, c.index_price, c.funding_rate, true,
      nextFunding.toISOString(),
    ];

    await client.query(sql, values);
    console.log(`Upserted: ${c.symbol} Perpetual — ${c.max_leverage}x max leverage`);
  }

  const result = await client.query(
    'SELECT symbol, max_leverage, mark_price, funding_rate, is_active FROM futures_contracts ORDER BY symbol',
  );
  console.log('\nAll futures contracts:');
  for (const row of result.rows) {
    console.log(`  ${row.symbol} — ${row.max_leverage}x max, mark: $${row.mark_price}, funding: ${row.funding_rate} (${row.is_active ? 'active' : 'inactive'})`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
