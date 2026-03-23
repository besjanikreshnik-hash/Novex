# NovEx — Database Schema

## Design Principles

- UUIDv7 for all primary keys (time-ordered, globally unique)
- `NUMERIC` / `DECIMAL` for all financial amounts (never float)
- `TIMESTAMPTZ` for all timestamps
- Soft delete where needed (`deleted_at` column)
- Partitioning on high-volume tables (trades, orders, audit)
- All tables have `created_at`, `updated_at`

## Schema

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
                    -- pending_verification, active, suspended, banned
    kyc_tier        SMALLINT NOT NULL DEFAULT 0, -- 0=none, 1=basic, 2=enhanced
    referral_code   VARCHAR(20) UNIQUE NOT NULL,
    referred_by     UUID REFERENCES users(id),
    anti_phishing   VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE user_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    display_name    VARCHAR(100),
    avatar_url      VARCHAR(500),
    phone           VARCHAR(20),
    country         VARCHAR(3),  -- ISO 3166-1 alpha-3
    timezone        VARCHAR(50) DEFAULT 'UTC',
    locale          VARCHAR(10) DEFAULT 'en',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_2fa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            VARCHAR(20) NOT NULL, -- totp, sms, email
    secret_enc      TEXT NOT NULL,  -- encrypted TOTP secret
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_2fa_primary ON user_2fa(user_id) WHERE is_primary = true;

CREATE TABLE user_passkeys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    credential_id   TEXT NOT NULL UNIQUE,
    public_key      TEXT NOT NULL,
    sign_count      BIGINT NOT NULL DEFAULT 0,
    device_name     VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
    device_hash     VARCHAR(64) NOT NULL,
    ip_address      INET NOT NULL,
    user_agent      TEXT,
    location        VARCHAR(100),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE user_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    device_hash     VARCHAR(64) NOT NULL,
    device_name     VARCHAR(100),
    platform        VARCHAR(20),  -- web, ios, android, extension
    is_trusted      BOOLEAN NOT NULL DEFAULT false,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_hash)
);

CREATE TABLE login_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    ip_address      INET NOT NULL,
    device_hash     VARCHAR(64),
    location        VARCHAR(100),
    status          VARCHAR(20) NOT NULL, -- success, failed_password, failed_2fa, blocked
    risk_score      NUMERIC(3,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_history_user ON login_history(user_id, created_at DESC);

-- ============================================================
-- KYC
-- ============================================================
CREATE TABLE kyc_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    tier            SMALLINT NOT NULL, -- 1 or 2
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending, in_review, approved, rejected
    vendor          VARCHAR(50),  -- sumsub, jumio, etc.
    vendor_ref      VARCHAR(100), -- external reference ID
    rejection_reason TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     UUID REFERENCES users(id)  -- admin who reviewed
);

CREATE INDEX idx_kyc_user ON kyc_submissions(user_id, tier);
CREATE INDEX idx_kyc_status ON kyc_submissions(status) WHERE status = 'pending';

CREATE TABLE kyc_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES kyc_submissions(id),
    document_type   VARCHAR(30) NOT NULL, -- passport, drivers_license, selfie, proof_of_address
    storage_key     VARCHAR(500) NOT NULL, -- S3 key (encrypted)
    file_hash       VARCHAR(64) NOT NULL,  -- SHA-256 of original file
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSETS & TRADING PAIRS
-- ============================================================
CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          VARCHAR(10) NOT NULL UNIQUE,  -- BTC, ETH, USDT
    name            VARCHAR(100) NOT NULL,
    asset_type      VARCHAR(20) NOT NULL DEFAULT 'crypto', -- crypto, fiat
    decimals        SMALLINT NOT NULL DEFAULT 8,
    min_withdrawal  NUMERIC(30,18) NOT NULL,
    withdrawal_fee  NUMERIC(30,18) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    icon_url        VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_networks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    network         VARCHAR(20) NOT NULL,  -- ethereum, bitcoin, tron, bsc
    contract_addr   VARCHAR(100),          -- null for native assets
    deposit_enabled BOOLEAN NOT NULL DEFAULT true,
    withdraw_enabled BOOLEAN NOT NULL DEFAULT true,
    confirmations   SMALLINT NOT NULL DEFAULT 12,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(asset_id, network)
);

CREATE TABLE trading_pairs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          VARCHAR(20) NOT NULL UNIQUE,   -- BTC_USDT
    base_asset_id   UUID NOT NULL REFERENCES assets(id),
    quote_asset_id  UUID NOT NULL REFERENCES assets(id),
    price_decimals  SMALLINT NOT NULL DEFAULT 2,
    qty_decimals    SMALLINT NOT NULL DEFAULT 6,
    min_qty         NUMERIC(30,18) NOT NULL,
    max_qty         NUMERIC(30,18) NOT NULL,
    min_notional    NUMERIC(30,18) NOT NULL,       -- min order value in quote
    maker_fee       NUMERIC(10,6) NOT NULL DEFAULT 0.001,  -- 0.1%
    taker_fee       NUMERIC(10,6) NOT NULL DEFAULT 0.001,
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, delisted
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WALLETS & BALANCES
-- ============================================================
CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    available       NUMERIC(30,18) NOT NULL DEFAULT 0 CHECK (available >= 0),
    locked          NUMERIC(30,18) NOT NULL DEFAULT 0 CHECK (locked >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         BIGINT NOT NULL DEFAULT 0,  -- optimistic locking
    UNIQUE(user_id, asset_id)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

CREATE TABLE deposit_addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    network         VARCHAR(20) NOT NULL,
    address         VARCHAR(200) NOT NULL UNIQUE,
    memo            VARCHAR(100),  -- for chains that need memo/tag
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deposits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    network         VARCHAR(20) NOT NULL,
    tx_hash         VARCHAR(100) NOT NULL,
    address         VARCHAR(200) NOT NULL,
    amount          NUMERIC(30,18) NOT NULL,
    confirmations   SMALLINT NOT NULL DEFAULT 0,
    required_confs  SMALLINT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending, confirming, credited, failed
    credited_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deposits_user ON deposits(user_id, created_at DESC);
CREATE INDEX idx_deposits_status ON deposits(status) WHERE status IN ('pending', 'confirming');
CREATE UNIQUE INDEX idx_deposits_tx ON deposits(tx_hash, network);

CREATE TABLE withdrawals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    network         VARCHAR(20) NOT NULL,
    address         VARCHAR(200) NOT NULL,
    memo            VARCHAR(100),
    amount          NUMERIC(30,18) NOT NULL,
    fee             NUMERIC(30,18) NOT NULL,
    tx_hash         VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending, approved, processing, completed, rejected, failed
    risk_score      NUMERIC(3,2),
    approved_by     UUID REFERENCES users(id),  -- admin
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_user ON withdrawals(user_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON withdrawals(status) WHERE status IN ('pending', 'approved');

-- ============================================================
-- ORDERS & TRADES
-- ============================================================
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    pair_id         UUID NOT NULL REFERENCES trading_pairs(id),
    side            VARCHAR(4) NOT NULL,  -- buy, sell
    type            VARCHAR(10) NOT NULL, -- market, limit
    price           NUMERIC(30,18),       -- null for market orders
    quantity        NUMERIC(30,18) NOT NULL,
    filled_qty      NUMERIC(30,18) NOT NULL DEFAULT 0,
    remaining_qty   NUMERIC(30,18) NOT NULL,
    avg_fill_price  NUMERIC(30,18),
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
                    -- open, partial, filled, cancelled
    time_in_force   VARCHAR(5) NOT NULL DEFAULT 'GTC', -- GTC, IOC, FOK
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (example)
CREATE TABLE orders_2026_01 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE orders_2026_02 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE orders_2026_03 PARTITION OF orders
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_pair_status ON orders(pair_id, status) WHERE status IN ('open', 'partial');

CREATE TABLE trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair_id         UUID NOT NULL REFERENCES trading_pairs(id),
    buy_order_id    UUID NOT NULL,  -- can't FK to partitioned table easily
    sell_order_id   UUID NOT NULL,
    buyer_id        UUID NOT NULL REFERENCES users(id),
    seller_id       UUID NOT NULL REFERENCES users(id),
    price           NUMERIC(30,18) NOT NULL,
    quantity        NUMERIC(30,18) NOT NULL,
    buyer_fee       NUMERIC(30,18) NOT NULL,
    seller_fee      NUMERIC(30,18) NOT NULL,
    buyer_is_maker  BOOLEAN NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE trades_2026_01 PARTITION OF trades
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE trades_2026_02 PARTITION OF trades
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE trades_2026_03 PARTITION OF trades
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_trades_pair ON trades(pair_id, created_at DESC);
CREATE INDEX idx_trades_buyer ON trades(buyer_id, created_at DESC);
CREATE INDEX idx_trades_seller ON trades(seller_id, created_at DESC);

-- ============================================================
-- FEE TIERS
-- ============================================================
CREATE TABLE fee_tiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_volume      NUMERIC(30,18) NOT NULL,  -- 30-day volume in USD
    max_volume      NUMERIC(30,18),           -- null = unlimited
    maker_fee       NUMERIC(10,6) NOT NULL,
    taker_fee       NUMERIC(10,6) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MARKET DATA (Candles stored for fast retrieval)
-- ============================================================
CREATE TABLE candles (
    pair_id         UUID NOT NULL REFERENCES trading_pairs(id),
    interval        VARCHAR(5) NOT NULL,  -- 1m, 5m, 15m, 1h, 4h, 1d
    open_time       TIMESTAMPTZ NOT NULL,
    open            NUMERIC(30,18) NOT NULL,
    high            NUMERIC(30,18) NOT NULL,
    low             NUMERIC(30,18) NOT NULL,
    close           NUMERIC(30,18) NOT NULL,
    volume          NUMERIC(30,18) NOT NULL,
    quote_volume    NUMERIC(30,18) NOT NULL,
    trade_count     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (pair_id, interval, open_time)
) PARTITION BY RANGE (open_time);

-- ============================================================
-- NOTIFICATIONS & ALERTS
-- ============================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            VARCHAR(30) NOT NULL, -- trade_filled, deposit_credited, etc.
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    data            JSONB,        -- structured payload
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

CREATE TABLE price_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    pair_id         UUID NOT NULL REFERENCES trading_pairs(id),
    condition       VARCHAR(5) NOT NULL,  -- above, below
    target_price    NUMERIC(30,18) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    triggered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_active ON price_alerts(pair_id) WHERE is_active = true;

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE referral_rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID NOT NULL REFERENCES users(id),
    referee_id      UUID NOT NULL REFERENCES users(id),
    trade_id        UUID,
    commission       NUMERIC(30,18) NOT NULL,
    asset_id        UUID NOT NULL REFERENCES assets(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, credited
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_rewards_referrer ON referral_rewards(referrer_id, created_at DESC);

-- ============================================================
-- API KEYS
-- ============================================================
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    label           VARCHAR(100) NOT NULL,
    key_hash        VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of API key
    secret_enc      TEXT NOT NULL,                 -- encrypted secret
    permissions     VARCHAR[] NOT NULL DEFAULT '{}',
    ip_whitelist    INET[],
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE is_active = true;

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type      VARCHAR(10) NOT NULL,  -- user, admin, system
    actor_id        UUID,
    action          VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(30) NOT NULL,
    resource_id     UUID,
    ip_address      INET,
    device_hash     VARCHAR(64),
    details         JSONB,
    risk_score      NUMERIC(3,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- ============================================================
-- ADMIN
-- ============================================================
CREATE TABLE announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    type            VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, maintenance
    is_active       BOOLEAN NOT NULL DEFAULT true,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_config (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPPORT
-- ============================================================
CREATE TABLE support_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    subject         VARCHAR(200) NOT NULL,
    category        VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
                    -- open, in_progress, waiting_user, resolved, closed
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium',
    assigned_to     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE support_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES support_tickets(id),
    sender_type     VARCHAR(10) NOT NULL, -- user, admin, system
    sender_id       UUID REFERENCES users(id),
    body            TEXT NOT NULL,
    attachments     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Entity Relationship Summary

```
users ─┬── user_profiles (1:1)
       ├── user_2fa (1:N)
       ├── user_passkeys (1:N)
       ├── user_sessions (1:N)
       ├── user_devices (1:N)
       ├── login_history (1:N)
       ├── kyc_submissions (1:N)
       ├── wallets (1:N, one per asset)
       ├── deposit_addresses (1:N)
       ├── deposits (1:N)
       ├── withdrawals (1:N)
       ├── orders (1:N)
       ├── trades (as buyer or seller, 1:N)
       ├── notifications (1:N)
       ├── price_alerts (1:N)
       ├── api_keys (1:N)
       ├── referral_rewards (as referrer, 1:N)
       └── support_tickets (1:N)

assets ─┬── asset_networks (1:N)
        ├── wallets (1:N)
        └── trading_pairs (as base or quote, 1:N)

trading_pairs ─┬── orders (1:N)
               ├── trades (1:N)
               ├── candles (1:N)
               └── price_alerts (1:N)
```
