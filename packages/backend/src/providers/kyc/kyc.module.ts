import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/users/user.entity';
import { KycService } from './kyc.service';
import { KycWebhookController } from './kyc-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [KycWebhookController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
