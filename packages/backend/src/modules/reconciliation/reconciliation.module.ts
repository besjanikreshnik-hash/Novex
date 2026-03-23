import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationRun } from './entities/reconciliation-run.entity';
import { ReconciliationMismatch } from './entities/reconciliation-mismatch.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Order } from '../trading/entities/order.entity';
import { FeeLedger } from '../trading/entities/fee-ledger.entity';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReconciliationRun,
      ReconciliationMismatch,
      Wallet,
      Trade,
      Order,
      FeeLedger,
    ]),
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
