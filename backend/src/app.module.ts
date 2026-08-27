import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ActivityController } from './activity/activity.controller';
import { ActivityRepository } from './activity/activity.repository';
import { AuthGuard } from './auth/auth.guard';
import { AppConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { MarketController } from './market/market.controller';
import { MarketService } from './market/market.service';
import { ChainRepository } from './worker/chain.repository';
import { IndexerService } from './worker/indexer.service';
import { FeeService } from './wallet/fee.service';
import { WalletController } from './wallet/wallet.controller';
import { WalletService } from './wallet/wallet.service';
import { SponsorshipRepository } from './wallet/sponsorship.repository';
import { SponsorshipPolicyService } from './wallet/sponsorship-policy.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
  controllers: [HealthController, ActivityController, MarketController, WalletController],
  providers: [AuthGuard, ActivityRepository, MarketService, ChainRepository, IndexerService, FeeService, WalletService, SponsorshipRepository, SponsorshipPolicyService],
})
export class AppModule {}
