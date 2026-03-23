/**
 * Seed staking products into PostgreSQL.
 *
 * Usage:  node scripts/seed-staking-products.js
 */
const { Client } = require('pg');

const products = [
  {
    asset: 'BTC',
    name: 'BTC Flexible Savings',
    annual_rate: '2.5',
    min_amount: '0.001',
    max_amount: '0',
    lock_days: 0,
    max_capacity: '0',
  },
  {
    asset: 'ETH',
    name: 'ETH 30-Day Lock',
    annual_rate: '5.0',
    min_amount: '0.01',
    max_amount: '0',
    lock_days: 30,
    max_capacity: '0',
  },
  {
    asset: 'USDT',
    name: 'USDT 90-Day Lock',
    annual_rate: '8.0',
    min_amount: '10',
    max_amount: '0',
    lock_days: 90,
    max_capacity: '0',
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

  for (const p of products) {
    const sql = `
      INSERT INTO staking_products (
        asset, name, annual_rate, min_amount, max_amount,
        lock_days, status, total_staked, max_capacity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING
    `;
    const values = [
      p.asset, p.name, p.annual_rate, p.min_amount, p.max_amount,
      p.lock_days, 'active', '0', p.max_capacity,
    ];

    await client.query(sql, values);
    console.log(`Inserted: ${p.name} (${p.asset}, ${p.annual_rate}% APY, ${p.lock_days}-day lock)`);
  }

  const result = await client.query('SELECT name, asset, annual_rate, lock_days, status FROM staking_products ORDER BY asset');
  console.log('\nAll staking products:');
  for (const row of result.rows) {
    console.log(`  ${row.name} — ${row.asset} ${row.annual_rate}% APY, ${row.lock_days}-day lock (${row.status})`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
