import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Deposit } from './entities/deposit.entity';
import { Withdrawal } from './entities/withdrawal.entity';
import { DepositAddress } from './entities/deposit-address.entity';
import { WithdrawalAddressBook } from './entities/withdrawal-address-book.entity';
import { FundingService } from './funding.service';
import { FundingController } from './funding.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit, Withdrawal, DepositAddress, WithdrawalAddressBook]),
    EventEmitterModule.forRoot(),
    WalletsModule,
    UsersModule,
  ],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
