import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuturesContract } from './futures-contract.entity';
import { FuturesPosition } from './futures-position.entity';
import { FuturesOrder } from './futures-order.entity';
import { FuturesController } from './futures.controller';
import { FuturesService } from './futures.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FuturesContract, FuturesPosition, FuturesOrder]),
    WalletsModule,
  ],
  controllers: [FuturesController],
  providers: [FuturesService],
  exports: [FuturesService],
})
export class FuturesModule {}
