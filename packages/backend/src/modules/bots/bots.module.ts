import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GridBot } from './grid-bot.entity';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { TradingModule } from '../trading/trading.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GridBot]),
    TradingModule,
    WalletsModule,
  ],
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
