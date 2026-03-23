/**
 * NovEx — Database Seed Script
 *
 * Creates:
 *   - 3 trading pairs: BTC/USDT, ETH/USDT, SOL/USDT
 *   - 3 test users: admin, alice (trader), bob (trader)
 *   - Initial wallet balances for all users
 *   - Default fee tiers
 *   - System config entries
 *
 * Usage: npm run seed
 * Reset:  npm run db:reset (drops, migrates, seeds)
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { dataSourceOptions } from '../../config/data-source';

async function seed(): Promise<void> {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected to database');

  const queryRunner = ds.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    // ── Trading Pairs ─────────────────────────────────────
    console.log('Seeding trading pairs...');
    await queryRunner.query(`
      INSERT INTO "trading_pairs" ("symbol", "base_currency", "quote_currency", "price_precision", "quantity_precision", "min_quantity", "maker_fee", "taker_fee", "is_active")
      VALUES
        ('BTC_USDT',  'BTC',  'USDT', 2, 6, 0.00001,  0.001, 0.001, true),
        ('ETH_USDT',  'ETH',  'USDT', 2, 5, 0.0001,   0.001, 0.001, true),
        ('SOL_USDT',  'SOL',  'USDT', 2, 3, 0.01,     0.001, 0.001, true)
      ON CONFLICT ("symbol") DO NOTHING;
    `);

    // ── Test Users ────────────────────────────────────────
    console.log('Seeding test users...');
    const passwordHash = await bcrypt.hash('NovEx_Test_2024!', 12);

    const [adminResult] = await queryRunner.query(`
      INSERT INTO "users" ("email", "password_hash", "first_name", "last_name", "role", "kyc_status", "is_active")
      VALUES ($1, $2, 'Admin', 'NovEx', 'admin', 'verified', true)
      ON CONFLICT ("email") DO UPDATE SET "updated_at" = NOW()
      RETURNING "id";
    `, ['admin@novex.io', passwordHash]);

    const [aliceResult] = await queryRunner.query(`
      INSERT INTO "users" ("email", "password_hash", "first_name", "last_name", "role", "kyc_status", "is_active")
      VALUES ($1, $2, 'Alice', 'Trader', 'user', 'verified', true)
      ON CONFLICT ("email") DO UPDATE SET "updated_at" = NOW()
      RETURNING "id";
    `, ['alice@test.novex.io', passwordHash]);

    const [bobResult] = await queryRunner.query(`
      INSERT INTO "users" ("email", "password_hash", "first_name", "last_name", "role", "kyc_status", "is_active")
      VALUES ($1, $2, 'Bob', 'Trader', 'user', 'verified', true)
      ON CONFLICT ("email") DO UPDATE SET "updated_at" = NOW()
      RETURNING "id";
    `, ['bob@test.novex.io', passwordHash]);

    const adminId = adminResult.id;
    const aliceId = aliceResult.id;
    const bobId = bobResult.id;

    // ── Wallet Balances ───────────────────────────────────
    console.log('Seeding wallet balances...');

    const walletEntries = [
      // Admin — small balances for testing admin operations
      { userId: adminId, currency: 'USDT', available: '10000' },
      { userId: adminId, currency: 'BTC',  available: '0.5' },

      // Alice — well-funded trader
      { userId: aliceId, currency: 'USDT', available: '100000' },
      { userId: aliceId, currency: 'BTC',  available: '2' },
      { userId: aliceId, currency: 'ETH',  available: '20' },
      { userId: aliceId, currency: 'SOL',  available: '500' },

      // Bob — moderate balances
      { userId: bobId, currency: 'USDT', available: '50000' },
      { userId: bobId, currency: 'BTC',  available: '1' },
      { userId: bobId, currency: 'ETH',  available: '10' },
      { userId: bobId, currency: 'SOL',  available: '200' },
    ];

    for (const w of walletEntries) {
      await queryRunner.query(`
        INSERT INTO "wallets" ("user_id", "currency", "available", "locked")
        VALUES ($1, $2, $3, 0)
        ON CONFLICT ("user_id", "currency") DO UPDATE SET "available" = $3, "updated_at" = NOW();
      `, [w.userId, w.currency, w.available]);
    }

    // ── System Config ─────────────────────────────────────
    console.log('Seeding system config...');
    const configs = [
      {
        key: 'platform.name',
        value: JSON.stringify('NovEx'),
        description: 'Platform display name',
      },
      {
        key: 'platform.maintenance',
        value: JSON.stringify(false),
        description: 'Enable maintenance mode',
      },
      {
        key: 'withdrawal.daily_limit_usd',
        value: JSON.stringify(50000),
        description: 'Default daily withdrawal limit in USD equivalent',
      },
      {
        key: 'withdrawal.require_2fa',
        value: JSON.stringify(true),
        description: 'Require 2FA for all withdrawals',
      },
      {
        key: 'kyc.provider',
        value: JSON.stringify('mock'),
        description: 'Active KYC provider (mock, sumsub, jumio)',
      },
      {
        key: 'referral.commission_rate',
        value: JSON.stringify(0.2),
        description: 'Referral commission rate (20% of trading fee)',
      },
    ];

    for (const c of configs) {
      await queryRunner.query(`
        INSERT INTO "system_config" ("key", "value", "description", "updated_by")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updated_at" = NOW();
      `, [c.key, c.value, c.description, adminId]);
    }

    // ── Launchpad Projects ────────────────────────────────
    console.log('Seeding launchpad projects...');

    const nvxStartDate = new Date();
    nvxStartDate.setDate(nvxStartDate.getDate() + 7);
    const nvxEndDate = new Date(nvxStartDate);
    nvxEndDate.setDate(nvxEndDate.getDate() + 30);

    await queryRunner.query(`
      INSERT INTO "launchpad_projects" (
        "name", "token_symbol", "description", "total_supply",
        "price_per_token", "hard_cap", "soft_cap", "raised",
        "status", "start_date", "end_date",
        "vesting_schedule", "social_links", "logo_url"
      )
      VALUES (
        'NovToken', 'NVX',
        'NovToken is the native utility token of the NovEx ecosystem. It provides fee discounts, governance voting rights, and staking rewards.',
        '1000000000', '0.10', '500000', '100000', '0',
        'upcoming', $1, $2,
        '{"tge": "25%", "month3": "25%", "month6": "25%", "month12": "25%"}',
        '{"website": "https://novex.io", "twitter": "https://twitter.com/novex", "telegram": "https://t.me/novex"}',
        ''
      )
      ON CONFLICT DO NOTHING;
    `, [nvxStartDate.toISOString(), nvxEndDate.toISOString()]);

    const dfsStartDate = new Date();
    dfsStartDate.setDate(dfsStartDate.getDate() - 5);
    const dfsEndDate = new Date(dfsStartDate);
    dfsEndDate.setDate(dfsEndDate.getDate() + 21);

    await queryRunner.query(`
      INSERT INTO "launchpad_projects" (
        "name", "token_symbol", "description", "total_supply",
        "price_per_token", "hard_cap", "soft_cap", "raised",
        "status", "start_date", "end_date",
        "vesting_schedule", "social_links", "logo_url"
      )
      VALUES (
        'DeFi Shield', 'DFS',
        'DeFi Shield provides decentralized insurance coverage for DeFi protocols. DFS token holders can stake to provide coverage and earn premiums.',
        '500000000', '0.05', '200000', '50000', '47500',
        'active', $1, $2,
        '{"tge": "30%", "month1": "20%", "month3": "25%", "month6": "25%"}',
        '{"website": "https://defishield.io", "twitter": "https://twitter.com/defishield"}',
        ''
      )
      ON CONFLICT DO NOTHING;
    `, [dfsStartDate.toISOString(), dfsEndDate.toISOString()]);

    await queryRunner.commitTransaction();

    console.log('\n✅ Seed complete!');
    console.log('─────────────────────────────────────────');
    console.log('Test accounts (password: NovEx_Test_2024!):');
    console.log(`  Admin: admin@novex.io       (id: ${adminId})`);
    console.log(`  Alice: alice@test.novex.io   (id: ${aliceId})`);
    console.log(`  Bob:   bob@test.novex.io     (id: ${bobId})`);
    console.log('─────────────────────────────────────────');
    console.log('Trading pairs: BTC_USDT, ETH_USDT, SOL_USDT');
    console.log('Launchpad: NovToken (NVX), DeFi Shield (DFS)');
    console.log('─────────────────────────────────────────\n');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
