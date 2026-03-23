/**
 * Seed fee tiers into PostgreSQL.
 *
 * Usage:  node scripts/seed-fee-tiers.js
 */
const { Client } = require('pg');

const tiers = [
  { tier: 0, name: 'Regular',  min_volume_30d: '0',       maker_fee_rate: '0.001',  taker_fee_rate: '0.001'  },
  { tier: 1, name: 'VIP1',     min_volume_30d: '10000',   maker_fee_rate: '0.0009', taker_fee_rate: '0.001'  },
  { tier: 2, name: 'VIP2',     min_volume_30d: '50000',   maker_fee_rate: '0.0008', taker_fee_rate: '0.0009' },
  { tier: 3, name: 'VIP3',     min_volume_30d: '100000',  maker_fee_rate: '0.0007', taker_fee_rate: '0.0008' },
  { tier: 4, name: 'VIP4',     min_volume_30d: '500000',  maker_fee_rate: '0.0006', taker_fee_rate: '0.0007' },
  { tier: 5, name: 'VIP5',     min_volume_30d: '1000000', maker_fee_rate: '0.0005', taker_fee_rate: '0.0006' },
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

  for (const t of tiers) {
    const sql = `
      INSERT INTO fee_tiers (tier, name, min_volume_30d, maker_fee_rate, taker_fee_rate, benefits)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tier) DO UPDATE
        SET name = EXCLUDED.name,
            min_volume_30d = EXCLUDED.min_volume_30d,
            maker_fee_rate = EXCLUDED.maker_fee_rate,
            taker_fee_rate = EXCLUDED.taker_fee_rate
    `;
    const values = [
      t.tier, t.name, t.min_volume_30d, t.maker_fee_rate, t.taker_fee_rate, '{}',
    ];

    await client.query(sql, values);
    console.log(`Upserted: ${t.name} — maker ${(parseFloat(t.maker_fee_rate) * 100).toFixed(2)}%, taker ${(parseFloat(t.taker_fee_rate) * 100).toFixed(2)}%, min vol $${t.min_volume_30d}`);
  }

  const result = await client.query('SELECT tier, name, min_volume_30d, maker_fee_rate, taker_fee_rate FROM fee_tiers ORDER BY tier');
  console.log('\nAll fee tiers:');
  for (const row of result.rows) {
    console.log(`  ${row.name} (Tier ${row.tier}) — Maker: ${(parseFloat(row.maker_fee_rate) * 100).toFixed(2)}%, Taker: ${(parseFloat(row.taker_fee_rate) * 100).toFixed(2)}%, Min Vol: $${row.min_volume_30d}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
