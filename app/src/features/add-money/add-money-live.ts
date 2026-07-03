import { runtimeConfig } from '@/config/runtime';
import {
  executeKlydeConversion,
  quoteKlydeConversion,
  type KlydeConversion,
  type KlydeQuote,
  type MoneyAmount,
} from '@/integrations/klyde';
import type { SendAssetCode } from '@/features/send/send-data';

type CreateLiveConversionInput = {
  amount: number;
  sourceAssetCode: SendAssetCode;
  targetAssetCode: SendAssetCode;
};

const moneyScaleByAsset: Record<SendAssetCode, number> = {
  NGN: 2,
  USDC: 6,
  USDT: 6,
};

export async function createLiveConversion(
  input: CreateLiveConversionInput,
): Promise<KlydeConversion | undefined> {
  const quote = await quoteLiveConversion(input);

  if (!quote) {
    return undefined;
  }

  return executeLiveConversionQuote(quote.id);
}

export async function quoteLiveConversion(
  input: CreateLiveConversionInput,
): Promise<KlydeQuote | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  return quoteKlydeConversion({
    amount: toKlydeMoneyAmount(input.amount, input.sourceAssetCode),
    market: 'NG',
    targetCurrency: input.targetAssetCode,
  });
}

export async function executeLiveConversionQuote(
  quoteId: string,
): Promise<KlydeConversion | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  return executeKlydeConversion(
    {
      quoteId,
    },
    {
      idempotencyKey: `paayee-conversion-${Date.now()}`,
    },
  );
}

function toKlydeMoneyAmount(amount: number, assetCode: SendAssetCode): MoneyAmount {
  const scale = moneyScaleByAsset[assetCode];
  const multiplier = 10 ** scale;

  return {
    currency: assetCode,
    display: String(amount),
    minorUnits: String(Math.round(amount * multiplier)),
    scale,
  };
}
