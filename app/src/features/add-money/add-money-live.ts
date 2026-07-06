import { runtimeConfig } from '@/config/runtime';
import {
  executeKlydeConversion,
  quoteKlydeConversion,
  type KlydeConversion,
  type KlydeQuote,
  type MoneyAmount,
} from '@/integrations/klyde';
import type { SendAssetCode } from '@/features/send/send-data';
import {
  isStablecoinAsset,
  preparePaayeePrivateStablecoinConversion,
  type PaayeePrivateConversionResult,
} from '@/features/confidential/confidential-money';

export type CreateLiveConversionInput = {
  amount: number;
  sourceAssetCode: SendAssetCode;
  targetAssetCode: SendAssetCode;
};

type ExecuteLivePrivateConversionInput = CreateLiveConversionInput & {
  chainId: number;
  rateLabel?: string;
  targetAmount: number;
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

  if (usesPrivateStablecoin(input)) {
    return createPrivateConversionQuote(input);
  }

  return quoteKlydeConversion({
    amount: toKlydeMoneyAmount(input.amount, input.sourceAssetCode),
    market: 'NG',
    targetCurrency: input.targetAssetCode,
  });
}

export async function executeLiveConversionQuote(
  quoteId: string | undefined,
): Promise<KlydeConversion | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  if (!quoteId) {
    throw new Error('Klyde returned a conversion quote without an id.');
  }

  if (quoteId.startsWith(privateConversionQuotePrefix)) {
    throw new Error('This private conversion must execute through Paayee confidential settlement rails.');
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

export async function executeLivePrivateStablecoinConversion(
  input: ExecuteLivePrivateConversionInput,
): Promise<PaayeePrivateConversionResult | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  if (
    !isStablecoinAsset(input.sourceAssetCode) ||
    !isStablecoinAsset(input.targetAssetCode) ||
    input.sourceAssetCode === input.targetAssetCode
  ) {
    throw new Error('Only USDC and USDT conversions can use Paayee confidential rails right now.');
  }

  return preparePaayeePrivateStablecoinConversion({
    chainId: input.chainId,
    rateLabel: input.rateLabel,
    sourceAmount: input.amount,
    sourceAssetCode: input.sourceAssetCode,
    targetAmount: input.targetAmount,
    targetAssetCode: input.targetAssetCode,
  });
}

export async function prepareLivePrivateConversionSettlement(
  input: ExecuteLivePrivateConversionInput,
): Promise<PaayeePrivateConversionResult | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  if (!usesPrivateStablecoin(input) || input.sourceAssetCode === input.targetAssetCode) {
    throw new Error('This conversion does not need Paayee private settlement rails.');
  }

  return preparePaayeePrivateStablecoinConversion({
    chainId: input.chainId,
    rateLabel: input.rateLabel,
    sourceAmount: input.amount,
    sourceAssetCode: input.sourceAssetCode,
    targetAmount: input.targetAmount,
    targetAssetCode: input.targetAssetCode,
  });
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

export function isPrivateStablecoinConversion(input: Pick<CreateLiveConversionInput, 'sourceAssetCode' | 'targetAssetCode'>): boolean {
  return (
    isStablecoinAsset(input.sourceAssetCode) &&
    isStablecoinAsset(input.targetAssetCode) &&
    input.sourceAssetCode !== input.targetAssetCode
  );
}

export function isPrivateStablecoinToNgnConversion(
  input: Pick<CreateLiveConversionInput, 'sourceAssetCode' | 'targetAssetCode'>,
): boolean {
  return isStablecoinAsset(input.sourceAssetCode) && input.targetAssetCode === 'NGN';
}

export function isNgnToPrivateStablecoinConversion(
  input: Pick<CreateLiveConversionInput, 'sourceAssetCode' | 'targetAssetCode'>,
): boolean {
  return input.sourceAssetCode === 'NGN' && isStablecoinAsset(input.targetAssetCode);
}

function usesPrivateStablecoin(input: Pick<CreateLiveConversionInput, 'sourceAssetCode' | 'targetAssetCode'>): boolean {
  return isStablecoinAsset(input.sourceAssetCode) || isStablecoinAsset(input.targetAssetCode);
}

function createPrivateConversionQuote(input: CreateLiveConversionInput): KlydeQuote {
  const createdAt = new Date();
  const settlementAmount = estimatePrivateConversionTargetAmount(input);

  return {
    id: `${privateConversionQuotePrefix}${createdAt.getTime()}`,
    appId: 'app_paayee_private',
    kind: 'swap',
    market: 'NG',
    providerReference: 'paayee-confidential-local-estimate',
    rateReference: readPrivateStablecoinRateReference(input),
    sourceAmount: toKlydeMoneyAmount(input.amount, input.sourceAssetCode),
    settlementAmount: toKlydeMoneyAmount(settlementAmount, input.targetAssetCode),
    status: 'active',
    expiresAt: new Date(createdAt.getTime() + 60_000).toISOString(),
    createdAt: createdAt.toISOString(),
  };
}

function estimatePrivateConversionTargetAmount(input: CreateLiveConversionInput): number {
  if (input.sourceAssetCode === 'NGN' && isStablecoinAsset(input.targetAssetCode)) {
    return input.amount / 1485;
  }

  if (isStablecoinAsset(input.sourceAssetCode) && input.targetAssetCode === 'NGN') {
    return input.amount * 1485;
  }

  if (input.sourceAssetCode === 'USDC' && input.targetAssetCode === 'USDT') {
    return input.amount * 0.998;
  }

  if (input.sourceAssetCode === 'USDT' && input.targetAssetCode === 'USDC') {
    return input.amount * 0.997;
  }

  return input.amount;
}

function readPrivateStablecoinRateReference(input: CreateLiveConversionInput): string {
  const rate = estimatePrivateConversionTargetAmount({
    ...input,
    amount: 1,
  });

  return `private-estimate:1-${input.sourceAssetCode}-${rate}-${input.targetAssetCode}`;
}

const privateConversionQuotePrefix = 'paayee_private_conversion_quote_';
