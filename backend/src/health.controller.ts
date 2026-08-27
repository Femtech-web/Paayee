import { Controller, Get, Inject } from '@nestjs/common';

import { AppConfig } from './config';

@Controller()
export class HealthController {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  @Get('health')
  health() {
    return { ok: true, service: 'paayee', chainId: this.config.chainId, indexerDriver: this.config.indexerDriver };
  }
}
