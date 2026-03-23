import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaunchpadProject } from './launchpad-project.entity';
import { LaunchpadContribution } from './launchpad-contribution.entity';
import { LaunchpadController } from './launchpad.controller';
import { LaunchpadService } from './launchpad.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LaunchpadProject, LaunchpadContribution]),
    WalletsModule,
  ],
  controllers: [LaunchpadController],
  providers: [LaunchpadService],
  exports: [LaunchpadService],
})
export class LaunchpadModule {}
