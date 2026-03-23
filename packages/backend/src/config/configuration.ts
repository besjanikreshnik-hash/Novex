import { readFileSync } from 'fs';

export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDev = nodeEnv === 'development' || nodeEnv === 'test';

  // ── SEC-1: JWT secret validation ────────────────────
  const jwtSecret = process.env.JWT_SECRET;
  if (!isDev) {
    if (!jwtSecret) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is required in non-development environments.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
      );
    }
    if (jwtSecret.length < 32) {
      throw new Error(
        `FATAL: JWT_SECRET must be at least 32 characters (current: ${jwtSecret.length}).`,
      );
    }
    if (jwtSecret === 'change-me' || jwtSecret === 'secret' || jwtSecret === 'jwt-secret') {
      throw new Error(
        'FATAL: JWT_SECRET is set to a known default value. Use a cryptographically random string.',
      );
    }
  }

  // ── SEC-2: DB SSL validation ────────────────────────
  const dbSsl = process.env.DATABASE_SSL === 'true';
  const dbSslCaPath = process.env.DATABASE_SSL_CA_PATH;
  let sslConfig: false | { rejectUnauthorized: boolean; ca?: string } = false;

  if (dbSsl) {
    if (!isDev && !dbSslCaPath) {
      throw new Error(
        'FATAL: DATABASE_SSL=true requires DATABASE_SSL_CA_PATH in non-development environments.\n' +
        'Download the RDS CA bundle: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
      );
    }
    sslConfig = {
      rejectUnauthorized: !isDev, // strict in non-dev, permissive in dev
    };
    if (dbSslCaPath) {
      try {
        sslConfig.ca = readFileSync(dbSslCaPath, 'utf8');
      } catch (err) {
        throw new Error(`FATAL: Cannot read DATABASE_SSL_CA_PATH=${dbSslCaPath}: ${err}`);
      }
    }
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv,
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',

    database: {
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      user: process.env.DATABASE_USER ?? 'novex',
      password: process.env.DATABASE_PASSWORD ?? 'novex_dev',
      name: process.env.DATABASE_NAME ?? 'novex',
      ssl: sslConfig,
    },

    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
    },

    kafka: {
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID ?? 'novex-backend',
      consumerGroup: process.env.KAFKA_CONSUMER_GROUP ?? 'novex-group',
    },

    jwt: {
      secret: jwtSecret ?? 'change-me-dev-only',
      accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
      refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
    },

    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    },

    // ── SEC-5: Admin IP allowlist ──────────────────────
    adminIpAllowlist: (process.env.ADMIN_IP_ALLOWLIST ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),

    // ── SEC-3: Metrics auth token ──────────────────────
    metricsToken: process.env.METRICS_TOKEN ?? '',

    logLevel: process.env.LOG_LEVEL ?? 'debug',
  };
};
