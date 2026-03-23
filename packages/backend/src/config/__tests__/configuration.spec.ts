/**
 * NovEx — Configuration Security Tests
 *
 * Verifies startup-time security validations added in pilot remediation.
 *
 * Run: npx jest src/config/__tests__/configuration.spec.ts
 */

describe('Configuration Security', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function loadConfig() {
    // Clear module cache to re-evaluate
    delete require.cache[require.resolve('../configuration')];
    const configFn = require('../configuration').default;
    return configFn();
  }

  describe('SEC-1: JWT Secret Validation', () => {
    it('allows any secret in development mode', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'short';
      expect(() => loadConfig()).not.toThrow();
    });

    it('rejects missing JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => loadConfig()).toThrow(/JWT_SECRET.*required/);
    });

    it('rejects short JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'tooshort';
      expect(() => loadConfig()).toThrow(/at least 32 characters/);
    });

    it('rejects known default JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'change-me';
      expect(() => loadConfig()).toThrow(/known default/);
    });

    it('accepts strong JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.DATABASE_SSL = 'false';
      expect(() => loadConfig()).not.toThrow();
    });
  });

  describe('SEC-2: DB SSL Validation', () => {
    it('allows no SSL in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_SSL = 'false';
      const config = loadConfig();
      expect(config.database.ssl).toBe(false);
    });

    it('allows SSL without CA in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_SSL = 'true';
      const config = loadConfig();
      expect(config.database.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('rejects SSL without CA path in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.DATABASE_SSL = 'true';
      delete process.env.DATABASE_SSL_CA_PATH;
      expect(() => loadConfig()).toThrow(/DATABASE_SSL_CA_PATH/);
    });
  });

  describe('SEC-5: Admin IP Allowlist Config', () => {
    it('parses comma-separated allowlist', () => {
      process.env.NODE_ENV = 'development';
      process.env.ADMIN_IP_ALLOWLIST = '10.0.0.1,192.168.1.0/24';
      const config = loadConfig();
      expect(config.adminIpAllowlist).toEqual(['10.0.0.1', '192.168.1.0/24']);
    });

    it('returns empty array when not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ADMIN_IP_ALLOWLIST;
      const config = loadConfig();
      expect(config.adminIpAllowlist).toEqual([]);
    });
  });

  describe('SEC-3: Metrics Token Config', () => {
    it('reads METRICS_TOKEN from env', () => {
      process.env.NODE_ENV = 'development';
      process.env.METRICS_TOKEN = 'my-secret-token';
      const config = loadConfig();
      expect(config.metricsToken).toBe('my-secret-token');
    });

    it('defaults to empty string', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.METRICS_TOKEN;
      const config = loadConfig();
      expect(config.metricsToken).toBe('');
    });
  });
});
