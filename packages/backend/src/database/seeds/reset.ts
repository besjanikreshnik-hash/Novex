/**
 * NovEx — Database Reset Script
 *
 * Drops all tables, runs migrations, then seeds.
 * WARNING: Destroys all data. For development/testing only.
 *
 * Usage: npm run db:reset
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../config/data-source';
import { execSync } from 'child_process';
import * as path from 'path';

async function reset(): Promise<void> {
  console.log('⚠️  Resetting database...\n');

  // Step 1: Drop all tables
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();

  const queryRunner = ds.createQueryRunner();
  await queryRunner.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `);

  // Drop custom enum types
  await queryRunner.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS "' || r.typname || '" CASCADE';
      END LOOP;
    END $$;
  `);

  await queryRunner.release();
  await ds.destroy();
  console.log('✓ All tables dropped');

  // Step 2: Run migrations
  const backendRoot = path.resolve(__dirname, '../../../');
  console.log('Running migrations...');
  execSync('npm run migration:run', { cwd: backendRoot, stdio: 'inherit' });
  console.log('✓ Migrations complete');

  // Step 3: Run seed
  console.log('Running seed...');
  execSync('npx ts-node -r tsconfig-paths/register src/database/seeds/seed.ts', {
    cwd: backendRoot,
    stdio: 'inherit',
  });

  console.log('\n✅ Database reset complete!');
}

reset().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
