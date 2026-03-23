# NovEx — DevOps & Infrastructure Plan

## 1. Container Strategy

### Docker Images

| Image              | Base           | Size Target | Notes                        |
|--------------------|----------------|-------------|------------------------------|
| novex-backend      | node:20-alpine | < 200MB     | Multi-stage build            |
| novex-web          | node:20-alpine | < 150MB     | Static export where possible |
| novex-admin        | node:20-alpine | < 150MB     | Static export                |
| novex-migrations   | node:20-alpine | < 100MB     | DB migration runner          |

### Docker Compose (Local Development)

```
Services:
  - backend (NestJS, port 3000)
  - web (Next.js, port 3001)
  - admin (Next.js, port 3002)
  - postgres (port 5432)
  - redis (port 6379)
  - kafka + zookeeper (port 9092)
  - kafka-ui (port 8080, development only)
  - mailhog (port 8025, development only)
```

## 2. CI/CD Pipeline (GitHub Actions)

### Workflows

**ci.yml** — Runs on every PR
```
1. Lint (ESLint + Prettier check)
2. Type check (tsc --noEmit)
3. Unit tests (Jest, parallel per package)
4. Build (all packages)
5. Security scan (npm audit, Trivy)
6. Schema validation (DB migrations dry-run)
```

**deploy-staging.yml** — On merge to `develop`
```
1. Run CI checks
2. Build Docker images
3. Push to ECR (tagged: sha-{commit})
4. Run DB migrations on staging
5. Deploy to EKS staging namespace
6. Run smoke tests
7. Notify Slack
```

**deploy-production.yml** — On merge to `main` (manual approval)
```
1. Run CI checks
2. Build Docker images
3. Push to ECR (tagged: v{version} + latest)
4. Create GitHub release
5. Manual approval gate
6. Blue-green deployment:
   a. Deploy new version to green
   b. Run health checks
   c. Switch traffic to green
   d. Keep blue for 30min rollback window
7. Run smoke tests
8. Notify Slack + PagerDuty
```

**dependency-update.yml** — Weekly (Dependabot + manual)
```
1. Check for dependency updates
2. Open PR with updates
3. Run full CI
4. Auto-merge patch updates (if tests pass)
```

## 3. Kubernetes Architecture

### Cluster Design

```
EKS Cluster:
  Node Groups:
    - system:    2x t3.medium  (ingress, monitoring)
    - app:       3x t3.large   (API, services)
    - matching:  2x c6g.xlarge (matching engine, compute-optimized)

  Namespaces:
    - novex-prod
    - novex-staging
    - novex-monitoring
    - novex-ingress
```

### Deployment Strategy

```yaml
# Example: backend deployment
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
        - resources:
            requests: { cpu: 500m, memory: 512Mi }
            limits:   { cpu: 1000m, memory: 1Gi }
          livenessProbe:
            httpGet: { path: /health, port: 3000 }
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: /health/ready, port: 3000 }
            periodSeconds: 10
```

### Auto-Scaling

```
HPA (Horizontal Pod Autoscaler):
  Backend API:  min=2, max=10, target CPU=70%
  WebSocket:    min=2, max=8,  target connections=5000
  Market Data:  min=2, max=6,  target CPU=60%
  Matching:     min=2, max=4,  target CPU=50% (keep headroom)
```

## 4. Database Operations

### Backup Strategy

```
Automated (RDS):
  - Continuous backup with PITR (Point-in-Time Recovery)
  - Daily snapshots, retained 30 days
  - Cross-region replica for DR (us-west-2 backup)

Manual:
  - Pre-migration backup (always)
  - Monthly export to S3 (encrypted, for long-term archive)
```

### Migration Strategy

```
Tool: TypeORM migrations (code-first)

Process:
  1. Developer creates migration: npm run migration:generate
  2. Migration reviewed in PR
  3. CI runs migration dry-run against staging clone
  4. Staging deployment runs migration
  5. QA validates
  6. Production deployment runs migration (within blue-green window)

Rules:
  - Migrations must be backwards compatible (add columns nullable first)
  - No data migrations in schema migrations (separate scripts)
  - Rollback script required for every migration
  - Lock timeout: 5 seconds (fail fast, don't lock tables)
```

## 5. Monitoring & Alerting

### Dashboard Layout (Grafana)

```
Dashboard 1: System Health
  - Pod status across namespaces
  - CPU/Memory utilization per service
  - Network I/O
  - Disk usage (PVs)

Dashboard 2: Trading Platform
  - Orders per second
  - Trades per second
  - Matching engine latency (p50, p95, p99)
  - Order book depth
  - WebSocket connections

Dashboard 3: Business Metrics
  - 24h trading volume
  - New registrations
  - Active users
  - Deposit/withdrawal volume
  - Revenue (fees collected)

Dashboard 4: Security
  - Failed login rate
  - Rate limit hits
  - Suspicious withdrawal attempts
  - API key abuse detection
```

### Alert Rules

| Alert                        | Condition                      | Severity | Channel       |
|------------------------------|--------------------------------|----------|---------------|
| Service down                 | Health check fail > 2min       | Critical | PagerDuty     |
| High error rate              | 5xx rate > 1% for 5min        | High     | PagerDuty     |
| Matching engine slow         | p99 latency > 100ms           | High     | Slack + PD    |
| Database connection pool     | Usage > 80%                   | Warning  | Slack         |
| Disk space low               | < 20% free                    | Warning  | Slack         |
| Large withdrawal             | > $50K single withdrawal      | Info     | Slack #ops    |
| Unusual signup rate          | > 10x normal in 1 hour        | Warning  | Slack #sec    |
| Hot wallet low               | < 2% of total per asset       | High     | Slack + PD    |

## 6. Incident Response

```
Severity Levels:
  SEV1: Platform down, trading halted, funds at risk
        Response: < 5 min, all hands, war room
  SEV2: Partial outage, degraded performance
        Response: < 15 min, on-call + escalation
  SEV3: Minor issue, workaround exists
        Response: < 1 hour, on-call investigates
  SEV4: Low impact, cosmetic/minor
        Response: Next business day

Post-Incident:
  - Blameless post-mortem within 48 hours
  - Action items tracked in Linear/Jira
  - Monitoring improvements as first action
```

## 7. Cost Optimization

```
Month 1-3 (Development):
  - Local Docker Compose for development
  - Single small EKS cluster for staging
  - RDS db.t3.medium
  - Estimated: $500-800/month

Month 4-6 (Beta):
  - Production EKS cluster (3 nodes)
  - RDS db.r6g.large + 1 read replica
  - ElastiCache cache.t3.medium
  - MSK kafka.t3.small (3 brokers)
  - Estimated: $2,000-3,000/month

Month 7-12 (Production):
  - Auto-scaling EKS (3-10 nodes)
  - RDS db.r6g.xlarge + 2 replicas
  - ElastiCache cluster mode
  - MSK kafka.m5.large
  - CloudFront distribution
  - WAF + Shield
  - Estimated: $5,000-15,000/month

Savings:
  - Reserved Instances for baseline (30-40% savings)
  - Spot Instances for non-critical batch jobs
  - S3 lifecycle policies (archive old data)
  - Right-sizing reviews quarterly
```
