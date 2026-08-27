import { runtimeConfig } from '@/config/runtime';
import {
  executeKlydeConversion,
  type KlydeConversion,
  type KlydeQuote,
} from '@/integrations/klyde';
import { quotePaayeeConversion } from '@/integrations/paayee';
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

  return quotePaayeeConversion({
    amount: input.amount,
    sourceCurrency: input.sourceAssetCode,
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

  if (quoteId.startsWith('paayee_quote_')) {
    throw new Error('Paayee conversion settlement is not enabled yet. The displayed rate and fee are indicative only.');
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
