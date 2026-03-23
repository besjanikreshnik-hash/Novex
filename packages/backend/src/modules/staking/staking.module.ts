import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StakingProduct } from './staking-product.entity';
import { StakingPosition } from './staking-position.entity';
import { StakingController } from './staking.controller';
import { StakingService } from './staking.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StakingProduct, StakingPosition]),
    WalletsModule,
  ],
  controllers: [StakingController],
  providers: [StakingService],
  exports: [StakingService],
})
export class StakingModule {}
