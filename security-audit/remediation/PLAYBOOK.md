# NovEx — Remediation Playbook

Step-by-step fix procedures for Critical and High findings.

---

## NVX-001: JWT Secret Hardcoded Default (Critical)

### Root Cause
`configuration.ts` uses `??` operator with a fallback string, allowing the application to start with a known secret.

### Fix Steps

**Step 1: Remove default and fail fast**

```typescript
// src/config/configuration.ts
jwt: {
  secret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set and at least 32 characters. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }
    return secret;
  })(),
  accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
},
```

**Step 2: Generate production secret**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Store in AWS Secrets Manager, inject via EKS ExternalSecrets
```

**Step 3: Update .env.example**

```
JWT_SECRET=   # REQUIRED — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Step 4: Add CI check**

Add to CI pipeline: verify `JWT_SECRET` is not the default value in staging/production configs.

### Verification

```bash
# App should fail to start without JWT_SECRET
unset JWT_SECRET && npm run start:dev
# Expected: Error thrown, process exits

# App should fail with short secret
JWT_SECRET=tooshort npm run start:dev
# Expected: Error thrown

# App should start with proper secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))") npm run start:dev
# Expected: Normal startup
```

### Test to Add

```typescript
it('rejects startup with missing JWT_SECRET', () => {
  delete process.env.JWT_SECRET;
  expect(() => configuration()).toThrow(/JWT_SECRET must be set/);
});
```

---

## NVX-002: Database SSL Certificate Validation Disabled (High)

### Root Cause
SSL config uses `rejectUnauthorized: false` which accepts any certificate, defeating the purpose of SSL.

### Fix Steps

**Step 1: Download RDS CA bundle**

```bash
# Download the AWS RDS CA certificate bundle
curl -o rds-combined-ca-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

**Step 2: Update TypeORM config**

```typescript
ssl: config.get<boolean>('database.ssl')
  ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync(
        config.get<string>('database.sslCaPath', '/app/certs/rds-combined-ca-bundle.pem')
      ).toString(),
    }
  : false,
```

**Step 3: Add env var for CA path**

```
DATABASE_SSL=true
DATABASE_SSL_CA_PATH=/app/certs/rds-combined-ca-bundle.pem
```

**Step 4: Mount cert in container**

```yaml
# Kubernetes deployment
volumes:
  - name: rds-ca
    configMap:
      name: rds-ca-bundle
volumeMounts:
  - name: rds-ca
    mountPath: /app/certs
    readOnly: true
```

### Verification

```bash
# Verify SSL connection with proper CA validation
psql "sslmode=verify-full sslrootcert=rds-combined-ca-bundle.pem \
  host=novex-prod.xxxxx.rds.amazonaws.com \
  dbname=novex user=novex_admin"
```

---

## NVX-003: /metrics Endpoint Unauthenticated (Medium)

### Fix Steps

**Option A: Bearer token check (simplest)**

```typescript
@Get('metrics')
async getPrometheusMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const expected = this.config.get<string>('METRICS_TOKEN');
  if (expected && token !== expected) {
    res.status(403).end('Forbidden');
    return;
  }
  // ... serve metrics
}
```

Configure Prometheus scraper:
```yaml
authorization:
  credentials: <METRICS_TOKEN value>
```

**Option B: WAF IP restriction (recommended for production)**

Add AWS WAF rule: `/metrics` path restricted to Prometheus scraper IPs.

---

## NVX-006: No 2FA on Withdrawals (Medium)

### Fix Steps

**Step 1: Add TOTP verification to withdrawal DTO**

```typescript
// funding.controller.ts
@Post('withdrawals')
async requestWithdrawal(
  @Req() req: AuthReq,
  @Body() dto: {
    asset: string; network: string; address: string;
    memo?: string; amount: string;
    twoFactorCode: string;  // NEW
  },
) {
  await this.twoFactorService.verify(req.user.id, dto.twoFactorCode);
  return this.funding.requestWithdrawal(req.user.id, dto);
}
```

**Step 2: Implement TOTP verification service**

Use `otplib` library for TOTP generation/verification.

**Step 3: Store encrypted TOTP secret per user**

Add `totp_secret_enc` column to users table (AES-256-GCM encrypted).

### Verification

```
Withdraw without 2FA code → 400 or 403
Withdraw with wrong 2FA code → 403
Withdraw with correct 2FA code → succeeds
```

---

## NVX-007: No IP Allowlist on Admin Endpoints (Medium)

### Fix Steps

**Step 1: Create AdminIpGuard**

```typescript
@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly allowedCidrs: string[];

  constructor(config: ConfigService) {
    this.allowedCidrs = config.get<string>('ADMIN_IP_ALLOWLIST', '')
      .split(',').filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.allowedCidrs.length === 0) return true; // disabled
    const req = context.switchToHttp().getRequest();
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    // Check against CIDR ranges
    return this.allowedCidrs.some(cidr => isIpInCidr(clientIp, cidr));
  }
}
```

**Step 2: Apply to all admin controllers**

**Step 3: Add env var**

```
ADMIN_IP_ALLOWLIST=10.0.0.0/8,192.168.1.0/24
```
