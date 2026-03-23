import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositAddress } from '../../modules/funding/entities/deposit-address.entity';
import { Deposit } from '../../modules/funding/entities/deposit.entity';
import { DepositMonitorService } from './deposit-monitor.service';
import { FundingModule } from '../../modules/funding/funding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DepositAddress, Deposit]),
    FundingModule,
  ],
  providers: [DepositMonitorService],
  exports: [DepositMonitorService],
})
export class BlockchainModule {}
