import { BadGatewayException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { createPublicClient, formatEther, http, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';

import { AppConfig } from '../config';
import { MarketService } from '../market/market.service';

export type SponsoredCallKind = 'shield' | 'unshield' | 'public-send' | 'private-send';

@Injectable()
export class SponsorshipPolicyService {
  private readonly client;
  private readonly logger = new Logger(SponsorshipPolicyService.name);

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(MarketService) private readonly market: MarketService,
  ) {
    this.client = createPublicClient({ transport: http(config.rpcUrl) });
  }

  async assertEligible(input: {
    from: Address;
    to: Address;
    data: Hex;
    value?: Hex;
    kind: SponsoredCallKind;
  }) {
    const gasUnits = await this.estimateGasWithFhePropagationRetry(input);

    const gasCap = this.config.maxSponsoredGasUnits[input.kind];
    if (gasUnits > gasCap) {
      throw new HttpException(
        'This transaction is above Paayee’s sponsorship limit. Please try again later.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    let maxFeePerGasWei = 0n;
    let estimatedNetworkCostWei = 0n;
    let estimatedNetworkCostUsd = 0;
    if (this.config.chainId !== sepolia.id) {
      const fees = await this.client.estimateFeesPerGas();
      maxFeePerGasWei = fees.maxFeePerGas ?? fees.gasPrice ?? 0n;
      if (maxFeePerGasWei <= 0n) throw new BadGatewayException('The current network fee could not be determined.');
      estimatedNetworkCostWei = gasUnits * maxFeePerGasWei;
      estimatedNetworkCostUsd = Number(formatEther(estimatedNetworkCostWei)) * await this.market.ethUsd();
      if (estimatedNetworkCostUsd > this.config.maxSponsoredFeeUsd) {
        throw new HttpException(
          'Network demand is currently too high for Paayee sponsorship. Please try again later.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    return {
      estimatedGasUnits: gasUnits,
      estimatedMaxFeePerGasWei: maxFeePerGasWei,
      estimatedNetworkCostWei,
      estimatedNetworkCostUsd,
      gasCap,
    };
  }

  private async estimateGasWithFhePropagationRetry(input: {
    from: Address;
    to: Address;
    data: Hex;
    value?: Hex;
  }): Promise<bigint> {
    const delaysMs = [0, 1_000, 2_000, 4_000];
    let lastCause: unknown;

    for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
      if (delaysMs[attempt] > 0) await delay(delaysMs[attempt]);
      try {
        return await this.client.estimateGas({
          account: input.from,
          to: input.to,
          data: input.data,
          value: input.value ? BigInt(input.value) : 0n,
        });
      } catch (cause) {
        lastCause = cause;
        this.logger.warn(`Sponsored transaction simulation attempt ${attempt + 1}/${delaysMs.length} failed`);
      }
    }

    throw new BadGatewayException(
      lastCause instanceof Error && lastCause.message
        ? `The transaction simulation failed: ${lastCause.message}`
        : 'The transaction simulation failed.',
    );
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
