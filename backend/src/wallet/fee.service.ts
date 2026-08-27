import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '../config';
import type { FeeQuoteDto } from './dto/fee-quote.dto';
import { SponsorshipRepository } from './sponsorship.repository';

@Injectable()
export class FeeService {
  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(SponsorshipRepository) private readonly sponsorships: SponsorshipRepository,
  ) {}

  async quote(privyUserId: string, input: FeeQuoteDto) {
    if (input.chainId !== this.config.chainId) throw new BadRequestException('Unsupported fee network');
    const id = `fee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await this.sponsorships.recordQuote({
      id,
      privyUserId,
      chainId: input.chainId,
      kind: input.kind,
      tokenSymbol: input.assetCode,
      amountMinorUnits: input.amountMinorUnits,
      feeMinorUnits: '0',
      displayCurrency: input.displayCurrency,
      displayAmount: '0',
      gasUnits: '0',
      maxFeePerGasWei: '0',
      markupBps: 0,
      expiresAt,
    });

    return {
      id,
      kind: input.kind,
      assetCode: input.assetCode,
      amountMinorUnits: input.amountMinorUnits,
      feeAssetMinorUnits: '0',
      feeAssetDisplay: '0',
      displayCurrency: input.displayCurrency,
      displayAmount: '0',
      gasUnits: '0',
      maxFeePerGasWei: '0',
      maxFeePerGasGwei: '0',
      markupBps: 0,
      expiresAt,
      collectionStatus: 'waived' as const,
      collectionEnabled: false,
    };
  }
}
