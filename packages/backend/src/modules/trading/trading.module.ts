import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Order } from './entities/order.entity';
import { Trade } from './entities/trade.entity';
import { TradingPair } from './entities/trading-pair.entity';
import { FeeLedger } from './entities/fee-ledger.entity';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { MatchingEngineService } from './matching-engine.service';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Trade, TradingPair, FeeLedger]),
    EventEmitterModule.forRoot(),
    WalletsModule,
    UsersModule,
    NotificationsModule,
    ActivityModule,
  ],
  controllers: [TradingController],
  providers: [TradingService, MatchingEngineService],
  exports: [TradingService, MatchingEngineService],
})
export class TradingModule {}
