import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { P2pListing } from './p2p-listing.entity';
import { P2pOrder } from './p2p-order.entity';
import { P2pController } from './p2p.controller';
import { P2pService } from './p2p.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([P2pListing, P2pOrder]),
    WalletsModule,
  ],
  controllers: [P2pController],
  providers: [P2pService],
  exports: [P2pService],
})
export class P2pModule {}
