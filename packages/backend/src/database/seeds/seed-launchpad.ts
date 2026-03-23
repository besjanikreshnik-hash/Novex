/**
 * NovEx — Launchpad Seed Script
 *
 * Creates 2 sample launchpad projects:
 *   - NovToken (NVX) — upcoming, $0.10/token, $500K hard cap
 *   - DeFi Shield (DFS) — active, $0.05/token, $200K hard cap
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-launchpad.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../config/data-source';

async function seedLaunchpad(): Promise<void> {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected to database');

  const queryRunner = ds.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    console.log('Seeding launchpad projects...');

    // NovToken (NVX) — upcoming
    const nvxStartDate = new Date();
    nvxStartDate.setDate(nvxStartDate.getDate() + 7); // starts in 7 days
    const nvxEndDate = new Date(nvxStartDate);
    nvxEndDate.setDate(nvxEndDate.getDate() + 30); // 30-day sale

    await queryRunner.query(`
      INSERT INTO "launchpad_projects" (
        "name", "token_symbol", "description", "total_supply",
        "price_per_token", "hard_cap", "soft_cap", "raised",
        "status", "start_date", "end_date",
        "vesting_schedule", "social_links", "logo_url"
      )
      VALUES (
        'NovToken', 'NVX',
        'NovToken is the native utility token of the NovEx ecosystem. It provides fee discounts, governance voting rights, and staking rewards. NVX holders benefit from reduced trading fees, exclusive launchpad access, and participation in platform governance decisions.',
        '1000000000',
        '0.10',
        '500000',
        '100000',
        '0',
        'upcoming',
        $1, $2,
        '{"tge": "25%", "month3": "25%", "month6": "25%", "month12": "25%"}',
        '{"website": "https://novex.io", "twitter": "https://twitter.com/novex", "telegram": "https://t.me/novex", "discord": "https://discord.gg/novex"}',
        ''
      )
      ON CONFLICT DO NOTHING;
    `, [nvxStartDate.toISOString(), nvxEndDate.toISOString()]);

    // DeFi Shield (DFS) — active
    const dfsStartDate = new Date();
    dfsStartDate.setDate(dfsStartDate.getDate() - 5); // started 5 days ago
    const dfsEndDate = new Date(dfsStartDate);
    dfsEndDate.setDate(dfsEndDate.getDate() + 21); // 21-day sale

    await queryRunner.query(`
      INSERT INTO "launchpad_projects" (
        "name", "token_symbol", "description", "total_supply",
        "price_per_token", "hard_cap", "soft_cap", "raised",
        "status", "start_date", "end_date",
        "vesting_schedule", "social_links", "logo_url"
      )
      VALUES (
        'DeFi Shield', 'DFS',
        'DeFi Shield provides decentralized insurance coverage for DeFi protocols. DFS token holders can stake to provide coverage, earn premiums, and participate in claims assessment governance. The protocol covers smart contract exploits, oracle failures, and bridge hacks.',
        '500000000',
        '0.05',
        '200000',
        '50000',
        '47500',
        'active',
        $1, $2,
        '{"tge": "30%", "month1": "20%", "month3": "25%", "month6": "25%"}',
        '{"website": "https://defishield.io", "twitter": "https://twitter.com/defishield", "telegram": "https://t.me/defishield"}',
        ''
      )
      ON CONFLICT DO NOTHING;
    `, [dfsStartDate.toISOString(), dfsEndDate.toISOString()]);

    await queryRunner.commitTransaction();

    console.log('\n--- Launchpad seed complete! ---');
    console.log('Projects:');
    console.log('  1. NovToken (NVX)    — upcoming, $0.10/token, $500K hard cap');
    console.log('  2. DeFi Shield (DFS) — active,   $0.05/token, $200K hard cap, $47.5K raised');
    console.log('-------------------------------\n');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Launchpad seed failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

seedLaunchpad().catch((err) => {
  console.error(err);
  process.exit(1);
});
