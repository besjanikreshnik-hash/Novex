import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeTier } from './fee-tier.entity';
import { Trade } from '../trading/entities/trade.entity';
import { FeeTiersController } from './fee-tiers.controller';
import { FeeTiersService } from './fee-tiers.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeeTier, Trade])],
  controllers: [FeeTiersController],
  providers: [FeeTiersService],
  exports: [FeeTiersService],
})
export class FeeTiersModule {}
