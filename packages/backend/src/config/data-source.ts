/**
 * NovEx — TypeORM DataSource configuration
 *
 * Used by:
 *   - CLI migrations (typeorm CLI)
 *   - Seed scripts
 *   - Integration tests
 *
 * Reads from environment variables (or .env via dotenv).
 */
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

// Load .env for CLI usage
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch {
  // dotenv is optional — env vars may already be set
}

const isProduction = process.env.NODE_ENV === 'production';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'novex',
  password: process.env.DATABASE_PASSWORD ?? 'novex_dev',
  database: process.env.DATABASE_NAME ?? 'novex',
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,

  entities: [path.join(__dirname, '../modules/**/entities/*.entity{.ts,.js}'),
             path.join(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')],

  synchronize: false, // NEVER in production — use migrations
  logging: !isProduction,
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
