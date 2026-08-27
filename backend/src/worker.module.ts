import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { ChainRepository } from './worker/chain.repository';
import { IndexerService } from './worker/indexer.service';
import { SponsorshipRepository } from './wallet/sponsorship.repository';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
  providers: [ChainRepository, IndexerService, SponsorshipRepository],
})
export class WorkerModule {}
