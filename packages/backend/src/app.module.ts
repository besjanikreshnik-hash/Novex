import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { TradingModule } from './modules/trading/trading.module';
import { MarketModule } from './modules/market/market.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { FundingModule } from './modules/funding/funding.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { GuardsModule } from './common/guards/guards.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { MetricsInterceptor } from './common/metrics/metrics.interceptor';
import { ProvidersModule } from './providers/providers.module';
import { KycModule } from './providers/kyc/kyc.module';
import { BlockchainModule } from './providers/blockchain/blockchain.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { StakingModule } from './modules/staking/staking.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { EmailModule } from './common/email/email.module';
import { PushModule } from './common/push/push.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { FeeTiersModule } from './modules/fee-tiers/fee-tiers.module';
import { P2pModule } from './modules/p2p/p2p.module';
import { LaunchpadModule } from './modules/launchpad/launchpad.module';
import { FuturesModule } from './modules/futures/futures.module';
import { CopyTradingModule } from './modules/copy-trading/copy-trading.module';
import { BotsModule } from './modules/bots/bots.module';

@Module({
  imports: [
    // ── Config ────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // ── Logging (pino) ───────────────────────────────────
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('logLevel', 'debug'),
          transport:
            config.get<string>('nodeEnv') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
        },
      }),
    }),

    // ── Database ──────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        synchronize: config.get<string>('nodeEnv') !== 'production',
        logging: config.get<string>('nodeEnv') !== 'production',
      }),
    }),

    // ── Rate Limiting ────────────────────────────────────
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60000, limit: 100 },
        { name: 'auth', ttl: 60000, limit: 5 },
        { name: 'registration', ttl: 3600000, limit: 3 },
        { name: 'order-placement', ttl: 10000, limit: 10 },
        { name: 'order-cancel', ttl: 10000, limit: 20 },
      ],
    }),

    // ── Infrastructure ───────────────────────────────────
    IdempotencyModule,
    MetricsModule,
    ProvidersModule,

    // ── Feature Modules ──────────────────────────────────
    UsersModule,
    GuardsModule,
    AuthModule,
    WalletsModule,
    TradingModule,
    MarketModule,
    AuditModule,
    FundingModule,
    GovernanceModule,
    ReconciliationModule,
    NotificationsModule,
    KycModule,
    BlockchainModule,
    ReferralsModule,
    AlertsModule,
    StakingModule,
    ActivityModule,
    ApiKeysModule,
    EmailModule,
    PushModule,
    LeaderboardModule,
    FeeTiersModule,
    P2pModule,
    LaunchpadModule,
    FuturesModule,
    CopyTradingModule,
    BotsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
