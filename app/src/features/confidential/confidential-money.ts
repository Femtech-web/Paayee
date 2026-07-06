import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { runtimeConfig } from '@/config/runtime';
import {
  completeKlydeConfidentialOperation,
  completeKlydeConfidentialSettlement,
  getKlydeAccountSnapshot,
  getKlydeConfidentialBalance,
  getKlydeConfidentialBalanceHandle,
  markKlydeConfidentialOperationSubmitted,
  prepareKlydeConfidentialOperation,
  resolveKlydeConfidentialAsset,
  type KlydeConfidentialAmountReference,
  type KlydeConfidentialOperation,
} from '@/integrations/klyde';
import type { SendAssetCode } from '@/features/send/send-data';

import {
  executePaayeeConfidentialConversion,
  executePaayeeConfidentialTransfer,
  getPaayeeZamaConfidentialBalance,
  getPaayeeZamaConfidentialBalanceHandle,
} from './zama-mobile-runtime';
import {
  decryptMetadataEnvelope,
  encryptMetadataEnvelope,
  type EncryptedMetadataEnvelope,
} from './encrypted-metadata-envelope';

export type StablecoinAssetCode = Extract<SendAssetCode, 'USDC' | 'USDT'>;

export type PaayeePrivateSendInput = {
  amount: number;
  assetCode: StablecoinAssetCode;
  chainId: number;
  narration?: string;
  purpose?: string;
  recipient: {
    handle?: string;
    name: string;
    walletAddress: string;
  };
  sendMethod: 'handle' | 'stablecoin';
};

export type PaayeePrivateOperationEnvelope = {
  amountDisplay?: string;
  assetCode: SendAssetCode;
  createdAt: string;
  encryptedMetadataEnvelope?: EncryptedMetadataEnvelope;
  fromAddress?: string;
  id: string;
  operationId: string;
  operationType?: 'send' | 'conversion';
  purpose?: string;
  recipientHandle?: string;
  recipientName?: string;
  recipientWalletAddress?: string;
  sendMethod?: 'handle' | 'stablecoin';
  sourceAmountDisplay?: string;
  sourceAssetCode?: SendAssetCode;
  status: string;
  targetAmountDisplay?: string;
  targetAssetCode?: SendAssetCode;
  transactionHash?: string;
  userOperationHash?: string;
};

type PaayeePrivateReceiptPayload = Pick<
  PaayeePrivateOperationEnvelope,
  | 'amountDisplay'
  | 'assetCode'
  | 'fromAddress'
  | 'purpose'
  | 'recipientHandle'
  | 'recipientName'
  | 'recipientWalletAddress'
  | 'sendMethod'
  | 'sourceAmountDisplay'
  | 'sourceAssetCode'
  | 'targetAmountDisplay'
  | 'targetAssetCode'
>;

export type PaayeePrivateSendResult = {
  envelope: PaayeePrivateOperationEnvelope;
  kind: 'app_managed_confidential_operation';
  operation: KlydeConfidentialOperation;
  receiptId?: undefined;
  status: KlydeConfidentialOperation['status'];
};

export type PaayeePrivateConversionInput = {
  chainId: number;
  rateLabel?: string;
  sourceAmount: number;
  sourceAssetCode: SendAssetCode;
  targetAmount: number;
  targetAssetCode: SendAssetCode;
};

export type PaayeePrivateConversionResult = {
  envelope: PaayeePrivateOperationEnvelope;
  kind: 'app_managed_confidential_operation';
  operation: KlydeConfidentialOperation;
  status: KlydeConfidentialOperation['status'];
};

export type PaayeeConfidentialBalanceDisplay = {
  code: StablecoinAssetCode;
  displayAmount?: string;
  encryptedHandle?: string;
  status: 'available' | 'handle_available' | 'unavailable';
};

const privateEnvelopeKeyPrefix = 'paayee.privateOperationEnvelope.';
const privateEnvelopeIndexKey = 'paayee.privateOperationEnvelope.index';
const stablecoinScale: Record<StablecoinAssetCode, number> = {
  USDC: 6,
  USDT: 6,
};
const moneyScale: Record<SendAssetCode, number> = {
  NGN: 2,
  USDC: 6,
  USDT: 6,
};

/** Klyde's own USDC/USDT + cUSDC/cUSDT pair — funding, subgraph, auto-shield, balance, conversion. */
const KLYDE_ACTIVE_CONFIDENTIAL_MODE = 'klyde_managed' as const;

export function isStablecoinAsset(code: SendAssetCode): code is StablecoinAssetCode {
  return code === 'USDC' || code === 'USDT';
}

export async function preparePaayeePrivateStablecoinSend(
  input: PaayeePrivateSendInput,
): Promise<PaayeePrivateSendResult> {
  const { user, wallet } = await getKlydeAccountSnapshot();
  const sourceAddress = wallet.address;
  const envelopeId = createEnvelopeId();
  const commitmentNonce = createLocalNonce();
  const amountMinorUnits = toMinorUnits(input.amount, input.assetCode);
  const amountCommitment = await createAmountCommitment({
    amountMinorUnits,
    assetCode: input.assetCode,
    commitmentNonce,
    envelopeId,
    recipientWalletAddress: input.recipient.walletAddress,
    sourceAddress,
  });
  const receiptPayload: PaayeePrivateReceiptPayload = {
    amountDisplay: formatStablecoinAmount(input.amount, input.assetCode),
    assetCode: input.assetCode,
    fromAddress: sourceAddress,
    purpose: input.purpose,
    recipientHandle: input.recipient.handle,
    recipientName: input.recipient.name,
    recipientWalletAddress: input.recipient.walletAddress,
    sendMethod: input.sendMethod,
  };
  const encryptedMetadataEnvelope = await createEncryptedPrivateReceiptMetadata(receiptPayload, {
    chainId: input.chainId,
    envelopeId,
    ownerAddress: sourceAddress,
    purpose: 'private_send_receipt',
  });
  const amountReference: KlydeConfidentialAmountReference = {
    amountCommitment,
    metadataEnvelope: encryptedMetadataEnvelope,
    metadataEnvelopeId: envelopeId,
    operationPublicLabel: `${input.assetCode} private transfer`,
  };

  let operation = await prepareKlydeConfidentialOperation(
    {
      userId: user.id,
      chainId: input.chainId,
      underlyingSymbol: input.assetCode,
      kind: 'confidential_transfer',
      mode: KLYDE_ACTIVE_CONFIDENTIAL_MODE,
      amount: toKlydeMoneyAmount(input.amount, input.assetCode, amountMinorUnits),
      amountReference,
      fromAddress: sourceAddress,
      toAddress: input.recipient.walletAddress,
      metadata: {
        metadataEnvelopeSchemaVersion: encryptedMetadataEnvelope.schemaVersion,
        paayeePrivacyFlow: 'stablecoin_private_send',
        paayeeSendMethod: input.sendMethod,
      },
    },
    {
      idempotencyKey: `paayee-private-send-${envelopeId}`,
    },
  );

  let envelope: PaayeePrivateOperationEnvelope = {
    assetCode: input.assetCode,
    createdAt: new Date().toISOString(),
    encryptedMetadataEnvelope,
    fromAddress: sourceAddress,
    id: envelopeId,
    operationId: operation.id,
    operationType: 'send',
    status: operation.status,
  };

  await savePrivateOperationEnvelope(envelope);

  if (runtimeConfig.zamaMobileRuntimeEnabled) {
    try {
      const execution = await executePrivateStablecoinTransfer({
        amountMinorUnits,
        assetCode: input.assetCode,
        chainId: input.chainId,
        operation,
        recipientWalletAddress: input.recipient.walletAddress,
      });
      operation = execution.operation;
      envelope = {
        ...envelope,
        status: operation.status,
        transactionHash: execution.transactionHash,
        userOperationHash: execution.userOperationHash,
      };
      await savePrivateOperationEnvelope(envelope);
    } catch (error) {
      operation = await completeKlydeConfidentialOperation({
        operationId: operation.id,
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Paayee Zama mobile execution failed.',
        metadata: {
          paayeePrivacyFlow: 'stablecoin_private_send',
          paayeeZamaRuntime: 'mobile',
        },
      });
      envelope = {
        ...envelope,
        status: operation.status,
      };
      await savePrivateOperationEnvelope(envelope);
      throw error;
    }
  }

  return {
    envelope,
    kind: 'app_managed_confidential_operation',
    operation,
    status: operation.status,
  };
}

export async function preparePaayeePrivateStablecoinConversion(
  input: PaayeePrivateConversionInput,
): Promise<PaayeePrivateConversionResult> {
  if (input.sourceAssetCode === input.targetAssetCode) {
    throw new Error('Choose two different confidential assets to convert.');
  }

  const stablecoinToStablecoin = isStablecoinAsset(input.sourceAssetCode) && isStablecoinAsset(input.targetAssetCode);
  const ngnToStablecoin = input.sourceAssetCode === 'NGN' && isStablecoinAsset(input.targetAssetCode);
  const stablecoinToNgn = isStablecoinAsset(input.sourceAssetCode) && input.targetAssetCode === 'NGN';

  if (!stablecoinToStablecoin && !ngnToStablecoin && !stablecoinToNgn) {
    throw new Error('This private conversion pair is not supported yet.');
  }

  const { user, wallet } = await getKlydeAccountSnapshot();
  const ownerAddress = wallet.address;
  const envelopeId = createEnvelopeId();
  const sourceAmountMinorUnits = toMoneyMinorUnits(input.sourceAmount, input.sourceAssetCode);
  const targetAmountMinorUnits = toMoneyMinorUnits(input.targetAmount, input.targetAssetCode);
  const sourceAmountCommitment = await createConversionAmountCommitment({
    amountMinorUnits: sourceAmountMinorUnits,
    assetCode: input.sourceAssetCode,
    direction: 'source',
    envelopeId,
    ownerAddress,
  });
  const targetAmountCommitment = await createConversionAmountCommitment({
    amountMinorUnits: targetAmountMinorUnits,
    assetCode: input.targetAssetCode,
    direction: 'target',
    envelopeId,
    ownerAddress,
  });
  const amountCommitment = await createPairCommitment({
    envelopeId,
    sourceAmountCommitment,
    targetAmountCommitment,
  });
  const receiptPayload: PaayeePrivateReceiptPayload = {
    amountDisplay: formatPrivateMoneyAmount(input.targetAmount, input.targetAssetCode),
    assetCode: input.targetAssetCode,
    fromAddress: ownerAddress,
    sourceAmountDisplay: formatPrivateMoneyAmount(input.sourceAmount, input.sourceAssetCode),
    sourceAssetCode: input.sourceAssetCode,
    targetAmountDisplay: formatPrivateMoneyAmount(input.targetAmount, input.targetAssetCode),
    targetAssetCode: input.targetAssetCode,
  };
  const encryptedMetadataEnvelope = await createEncryptedPrivateReceiptMetadata(receiptPayload, {
    chainId: input.chainId,
    envelopeId,
    ownerAddress,
    purpose: 'private_conversion_receipt',
  });
  logPrivateConversionStage('metadata_encrypted', {
    envelopeId,
    sourceAssetCode: input.sourceAssetCode,
    targetAssetCode: input.targetAssetCode,
  });
  const amountReference: KlydeConfidentialAmountReference = {
    amountCommitment,
    metadataEnvelope: encryptedMetadataEnvelope,
    metadataEnvelopeId: envelopeId,
    operationPublicLabel: privateConversionPublicLabel(input.sourceAssetCode, input.targetAssetCode),
  };
  const confidentialAssetCode = isStablecoinAsset(input.targetAssetCode) ? input.targetAssetCode : input.sourceAssetCode;
  const conversionFlow = privateConversionFlow(input.sourceAssetCode, input.targetAssetCode);
  const privateSettlementAddress =
    conversionFlow === 'private_stablecoin_to_ngn_settlement'
      ? getKlydePrivateSettlementAddress(input.chainId)
      : undefined;

  let operation = await prepareKlydeConfidentialOperation(
    {
      userId: user.id,
      chainId: input.chainId,
      underlyingSymbol: confidentialAssetCode,
      kind: 'confidential_transfer',
      mode: KLYDE_ACTIVE_CONFIDENTIAL_MODE,
      amount: resolvePrivateConversionOperationAmount({
        sourceAmount: input.sourceAmount,
        sourceAmountMinorUnits,
        sourceAssetCode: input.sourceAssetCode,
        targetAmount: input.targetAmount,
        targetAmountMinorUnits,
        targetAssetCode: input.targetAssetCode,
      }),
      amountReference,
      fromAddress: ownerAddress,
      toAddress: privateSettlementAddress ?? ownerAddress,
      metadata: {
        activeRail: KLYDE_ACTIVE_CONFIDENTIAL_MODE,
        conversionExecution: stablecoinToStablecoin
          ? 'paayee_confidential_conversion_executor'
          : 'paayee_confidential_settlement_executor',
        metadataEnvelopeSchemaVersion: encryptedMetadataEnvelope.schemaVersion,
        paayeePrivacyFlow: conversionFlow,
        privateSettlementAddress,
        sourceAmountCommitment,
        sourceUnderlyingSymbol: input.sourceAssetCode,
        targetAmountCommitment,
        targetUnderlyingSymbol: input.targetAssetCode,
      },
    },
    {
      idempotencyKey: `paayee-private-conversion-${envelopeId}`,
    },
  );
  logPrivateConversionStage('operation_prepared', {
    envelopeId,
    operationId: operation.id,
    sourceAssetCode: input.sourceAssetCode,
    status: operation.status,
    targetAssetCode: input.targetAssetCode,
  });

  let envelope: PaayeePrivateOperationEnvelope = {
    assetCode: input.targetAssetCode,
    createdAt: new Date().toISOString(),
    encryptedMetadataEnvelope,
    fromAddress: ownerAddress,
    id: envelopeId,
    operationId: operation.id,
    operationType: 'conversion',
    status: operation.status,
  };

  await savePrivateOperationEnvelope(envelope);

  if (stablecoinToNgn && runtimeConfig.zamaMobileRuntimeEnabled) {
    const sourceAssetCode = input.sourceAssetCode;
    const targetAssetCode = input.targetAssetCode;
    if (!isStablecoinAsset(sourceAssetCode) || targetAssetCode !== 'NGN') {
      throw new Error('Private stablecoin to NGN settlement requires USDC or USDT as the source.');
    }

    try {
      const execution = await executePrivateStablecoinToNgnSettlement({
        chainId: input.chainId,
        operation,
        sourceAmountMinorUnits,
        sourceAssetCode,
        targetAmount: input.targetAmount,
        targetAmountMinorUnits,
        targetAssetCode,
      });
      operation = execution.operation;
      envelope = {
        ...envelope,
        status: operation.status,
        transactionHash: execution.transactionHash,
        userOperationHash: execution.userOperationHash,
      };
      await savePrivateOperationEnvelope(envelope);
    } catch (error) {
      operation = await completeKlydeConfidentialOperation({
        operationId: operation.id,
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Paayee private stablecoin to NGN settlement failed.',
        metadata: {
          paayeePrivacyFlow: conversionFlow,
          paayeeZamaRuntime: 'mobile',
        },
      });
      envelope = {
        ...envelope,
        status: operation.status,
      };
      await savePrivateOperationEnvelope(envelope);
      throw error;
    }
  }

  if (!stablecoinToStablecoin) {
    if (ngnToStablecoin) {
      operation = await completeKlydeConfidentialSettlement({
        operationId: operation.id,
        direction: 'ngn_to_private_stablecoin',
        sourceAmount: {
          currency: input.sourceAssetCode,
          display: String(input.sourceAmount),
          minorUnits: sourceAmountMinorUnits,
          scale: moneyScale[input.sourceAssetCode],
        },
        targetAmount: {
          currency: input.targetAssetCode,
          display: String(input.targetAmount),
          minorUnits: targetAmountMinorUnits,
          scale: moneyScale[input.targetAssetCode],
        },
        metadata: {
          chainId: input.chainId,
          paayeePrivacyFlow: conversionFlow,
          paayeeZamaRuntime: 'klyde_treasury_private_credit',
          targetUnderlyingSymbol: input.targetAssetCode,
        },
      }).then((settlement) => settlement.operation);
      envelope = {
        ...envelope,
        status: operation.status,
      };
      await savePrivateOperationEnvelope(envelope);
    }

    return {
      envelope,
      kind: 'app_managed_confidential_operation',
      operation,
      status: operation.status,
    };
  }

  const sourceStablecoinAssetCode = input.sourceAssetCode;
  const targetStablecoinAssetCode = input.targetAssetCode;

  if (!isStablecoinAsset(sourceStablecoinAssetCode) || !isStablecoinAsset(targetStablecoinAssetCode)) {
    throw new Error('Stablecoin conversion execution requires two confidential stablecoin assets.');
  }

  if (runtimeConfig.zamaMobileRuntimeEnabled) {
    try {
      const execution = await executePrivateStablecoinConversion({
        chainId: input.chainId,
        operation,
        sourceAmountMinorUnits,
        sourceAssetCode: sourceStablecoinAssetCode,
        targetAmountMinorUnits,
        targetAssetCode: targetStablecoinAssetCode,
      });
      operation = execution.operation;
      envelope = {
        ...envelope,
        status: operation.status,
        transactionHash: execution.transactionHash,
        userOperationHash: execution.userOperationHash,
      };
      await savePrivateOperationEnvelope(envelope);
    } catch (error) {
      operation = await completeKlydeConfidentialOperation({
        operationId: operation.id,
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Paayee confidential conversion execution failed.',
        metadata: {
          paayeePrivacyFlow: conversionFlow,
          paayeeZamaRuntime: 'mobile',
        },
      });
      envelope = {
        ...envelope,
        status: operation.status,
      };
      await savePrivateOperationEnvelope(envelope);
      throw error;
    }
  }

  return {
    envelope,
    kind: 'app_managed_confidential_operation',
    operation,
    status: operation.status,
  };
}

export async function getPaayeePrivateOperationEnvelope(
  envelopeId: string | undefined,
): Promise<PaayeePrivateOperationEnvelope | undefined> {
  if (!envelopeId) {
    return undefined;
  }

  const value = await SecureStore.getItemAsync(privateEnvelopeKey(envelopeId));
  if (!value) {
    return undefined;
  }

  try {
    return hydratePrivateOperationEnvelope(JSON.parse(value) as PaayeePrivateOperationEnvelope);
  } catch {
    return undefined;
  }
}

export async function listPaayeePrivateOperationEnvelopes(input: {
  hydrate?: boolean;
} = {}): Promise<PaayeePrivateOperationEnvelope[]> {
  const envelopeIds = await readPrivateOperationEnvelopeIndex();
  const envelopes = await Promise.all(
    envelopeIds.map(async (envelopeId) => {
      const value = await SecureStore.getItemAsync(privateEnvelopeKey(envelopeId));

      if (!value) {
        return undefined;
      }

      try {
        const envelope = JSON.parse(value) as PaayeePrivateOperationEnvelope;

        return input.hydrate === false ? envelope : hydratePrivateOperationEnvelope(envelope);
      } catch {
        return undefined;
      }
    }),
  );

  return envelopes
    .filter((envelope): envelope is PaayeePrivateOperationEnvelope => Boolean(envelope))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function getPaayeeConfidentialBalanceDisplay(input: {
  assetCode: StablecoinAssetCode;
  chainId: number;
  confidentialOperations?: KlydeConfidentialOperation[];
  hasOperationHistory?: boolean;
  owner?: string;
}): Promise<PaayeeConfidentialBalanceDisplay> {
  if (runtimeConfig.zamaMobileRuntimeEnabled) {
    const tokenAddress = await resolveActiveConfidentialBalanceTokenAddress(input.assetCode, input.chainId);

    try {
      const amount = await getPaayeeZamaConfidentialBalance({
        chainId: input.chainId,
        owner: input.owner,
        tokenAddress,
      });
      const numericAmount = Number(amount) / 10 ** stablecoinScale[input.assetCode];

      return {
        code: input.assetCode,
        displayAmount: formatStablecoinAmount(numericAmount, input.assetCode),
        status: 'available',
      };
    } catch (error) {
      logConfidentialBalanceRead('zama_balance_failed', input, error);

      const localOperationBalance = resolveLocalConfidentialOperationBalance(input);
      if (localOperationBalance !== undefined) {
        return {
          code: input.assetCode,
          displayAmount: formatStablecoinAmount(localOperationBalance, input.assetCode),
          status: 'available',
        };
      }

      try {
        const encryptedHandle = await getPaayeeZamaConfidentialBalanceHandle({
          chainId: input.chainId,
          owner: input.owner,
          tokenAddress,
        });

        return {
          code: input.assetCode,
          encryptedHandle,
          status: 'handle_available',
        };
      } catch (handleError) {
        logConfidentialBalanceRead('zama_handle_failed', input, handleError);
      }
    }
  }

  try {
    const balance = await getKlydeConfidentialBalance({
      chainId: input.chainId,
      owner: input.owner as `0x${string}` | undefined,
      underlyingSymbol: input.assetCode,
    });
    const amount = typeof balance.amount === 'bigint' ? balance.amount : BigInt(String(balance.amount));
    const numericAmount = Number(amount) / 10 ** stablecoinScale[input.assetCode];

    return {
      code: input.assetCode,
      displayAmount: formatStablecoinAmount(numericAmount, input.assetCode),
      encryptedHandle: balance.encryptedHandle,
      status: 'available',
    };
  } catch (error) {
    logConfidentialBalanceRead('klyde_privacy_engine_balance_failed', input, error);
    // Fall through to handle-only mode when the mobile relayer/decryption engine is not configured yet.
  }

  try {
    const handle = await getKlydeConfidentialBalanceHandle({
      chainId: input.chainId,
      owner: input.owner as `0x${string}` | undefined,
      underlyingSymbol: input.assetCode,
    });

    if (!handle.encryptedHandle) {
      return {
        code: input.assetCode,
        status: 'unavailable',
      };
    }

    return {
      code: input.assetCode,
      encryptedHandle: handle.encryptedHandle,
      status: 'handle_available',
    };
  } catch (error) {
    logConfidentialBalanceRead('klyde_privacy_engine_handle_failed', input, error);
    if (!input.hasOperationHistory) {
      return {
        code: input.assetCode,
        displayAmount: formatStablecoinAmount(0, input.assetCode),
        status: 'unavailable',
      };
    }

    return {
      code: input.assetCode,
      status: 'unavailable',
    };
  }
}

function logConfidentialBalanceRead(
  event: string,
  input: { assetCode: StablecoinAssetCode; chainId: number; hasOperationHistory?: boolean; owner?: string },
  error: unknown,
): void {
  if (!__DEV__) {
    return;
  }

  console.warn('[paayee.confidential.balance]', JSON.stringify({
    assetCode: input.assetCode,
    chainId: input.chainId,
    event,
    error: formatErrorForLog(error),
    hasOperationHistory: Boolean(input.hasOperationHistory),
    owner: input.owner ? shortenAddressForLog(input.owner) : undefined,
    zamaMobileRuntimeEnabled: runtimeConfig.zamaMobileRuntimeEnabled,
  }));
}

function shortenAddressForLog(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function formatStackForLog(stack?: string): string | undefined {
  if (!stack) {
    return undefined;
  }

  return stack.split('\n').slice(0, 5).join('\n');
}

function formatErrorForLog(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
    };
  }

  const candidate = error as Error & {
    cause?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  return {
    cause: candidate.cause ? formatErrorForLog(candidate.cause) : undefined,
    code: candidate.code,
    message: candidate.message,
    name: candidate.name,
    stack: formatStackForLog(candidate.stack),
    status: candidate.status,
    statusCode: candidate.statusCode,
  };
}

async function executePrivateStablecoinTransfer(input: {
  amountMinorUnits: string;
  assetCode: StablecoinAssetCode;
  chainId: number;
  operation: KlydeConfidentialOperation;
  recipientWalletAddress: string;
}): Promise<{
  operation: KlydeConfidentialOperation;
  transactionHash?: string;
  userOperationHash?: string;
}> {
  const tokenAddress = await resolvePrivateAssetTokenAddress(input.assetCode, input.chainId);
  const transfer = await executePaayeeConfidentialTransfer({
    amountMinorUnits: input.amountMinorUnits,
    chainId: input.chainId,
    recipient: input.recipientWalletAddress,
    tokenAddress,
  });
  const submitted = await markKlydeConfidentialOperationSubmitted({
    operationId: input.operation.id,
    transactionHash: transfer.transactionHash,
    userOperationHash: transfer.userOperationHash,
    metadata: {
      paayeePrivacyFlow: 'stablecoin_private_send',
      paayeeZamaRuntime: 'mobile',
      tokenAddress,
    },
  });
  const completed = await completeKlydeConfidentialOperation({
    operationId: submitted.id,
    status: 'succeeded',
    transactionHash: transfer.transactionHash,
    metadata: {
      paayeePrivacyFlow: 'stablecoin_private_send',
      paayeeZamaRuntime: 'mobile',
      tokenAddress,
    },
  });

  return {
    operation: completed,
    transactionHash: transfer.transactionHash,
    userOperationHash: transfer.userOperationHash,
  };
}

async function executePrivateStablecoinConversion(input: {
  chainId: number;
  operation: KlydeConfidentialOperation;
  sourceAmountMinorUnits: string;
  sourceAssetCode: StablecoinAssetCode;
  targetAmountMinorUnits: string;
  targetAssetCode: StablecoinAssetCode;
}): Promise<{
  operation: KlydeConfidentialOperation;
  transactionHash?: string;
  userOperationHash?: string;
}> {
  const [sourceTokenAddress, targetTokenAddress] = await Promise.all([
    resolvePrivateAssetTokenAddress(input.sourceAssetCode, input.chainId),
    resolvePrivateAssetTokenAddress(input.targetAssetCode, input.chainId),
  ]);
  const conversion = await executePaayeeConfidentialConversion({
    operationId: input.operation.id,
    sourceAmountMinorUnits: input.sourceAmountMinorUnits,
    sourceTokenAddress,
    targetAmountMinorUnits: input.targetAmountMinorUnits,
    targetTokenAddress,
  });
  const submitted = await markKlydeConfidentialOperationSubmitted({
    operationId: input.operation.id,
    transactionHash: conversion.transactionHash,
    userOperationHash: conversion.userOperationHash,
    metadata: {
      paayeePrivacyFlow: 'stablecoin_private_conversion',
      paayeeZamaRuntime: 'mobile',
      sourceTokenAddress,
      targetTokenAddress,
    },
  });
  const completed = await completeKlydeConfidentialOperation({
    operationId: submitted.id,
    status: 'succeeded',
    transactionHash: conversion.transactionHash,
    metadata: {
      paayeePrivacyFlow: 'stablecoin_private_conversion',
      paayeeZamaRuntime: 'mobile',
      sourceTokenAddress,
      targetTokenAddress,
    },
  });

  return {
    operation: completed,
    transactionHash: conversion.transactionHash,
    userOperationHash: conversion.userOperationHash,
  };
}

async function executePrivateStablecoinToNgnSettlement(input: {
  chainId: number;
  operation: KlydeConfidentialOperation;
  sourceAmountMinorUnits: string;
  sourceAssetCode: StablecoinAssetCode;
  targetAmount: number;
  targetAmountMinorUnits: string;
  targetAssetCode: 'NGN';
}): Promise<{
  operation: KlydeConfidentialOperation;
  transactionHash?: string;
  userOperationHash?: string;
}> {
  const sourceTokenAddress = await resolvePrivateAssetTokenAddress(input.sourceAssetCode, input.chainId);
  const settlementAddress = getKlydePrivateSettlementAddress(input.chainId);
  logPrivateConversionStage('private_settlement_transfer_starting', {
    operationId: input.operation.id,
    settlementAddress,
    sourceAssetCode: input.sourceAssetCode,
  });
  const privateSettlementTransfer = await executePaayeeConfidentialTransfer({
    amountMinorUnits: input.sourceAmountMinorUnits,
    chainId: input.chainId,
    recipient: settlementAddress,
    tokenAddress: sourceTokenAddress,
  });
  logPrivateConversionStage('private_settlement_transfer_submitted', {
    operationId: input.operation.id,
    settlementAddress,
    sourceAssetCode: input.sourceAssetCode,
    transactionHash: privateSettlementTransfer.transactionHash,
    userOperationHash: privateSettlementTransfer.userOperationHash,
  });
  const submitted = await markKlydeConfidentialOperationSubmitted({
    operationId: input.operation.id,
    transactionHash: privateSettlementTransfer.transactionHash,
    userOperationHash: privateSettlementTransfer.userOperationHash,
    metadata: {
      paayeePrivacyFlow: 'private_stablecoin_to_ngn_settlement',
      paayeeZamaRuntime: 'mobile',
      settlementAddress,
      sourceTokenAddress,
    },
  });
  const settlement = await completeKlydeConfidentialSettlement({
    operationId: submitted.id,
    direction: 'private_stablecoin_to_ngn',
    sourceAmount: {
      currency: input.sourceAssetCode,
      display: String(Number(input.sourceAmountMinorUnits) / 10 ** moneyScale[input.sourceAssetCode]),
      minorUnits: input.sourceAmountMinorUnits,
      scale: moneyScale[input.sourceAssetCode],
    },
    targetAmount: {
      currency: input.targetAssetCode,
      display: String(input.targetAmount),
      minorUnits: input.targetAmountMinorUnits,
      scale: moneyScale[input.targetAssetCode],
    },
    transactionHash: privateSettlementTransfer.transactionHash,
    userOperationHash: privateSettlementTransfer.userOperationHash,
    metadata: {
      paayeePrivacyFlow: 'private_stablecoin_to_ngn_settlement',
      paayeeZamaRuntime: 'mobile',
      settlementAddress,
      sourceTokenAddress,
    },
  });
  logPrivateConversionStage('settlement_completed', {
    operationId: settlement.operation.id,
    sourceAssetCode: input.sourceAssetCode,
    status: settlement.operation.status,
    targetAssetCode: input.targetAssetCode,
  });

  return {
    operation: settlement.operation,
    transactionHash: privateSettlementTransfer.transactionHash,
    userOperationHash: privateSettlementTransfer.userOperationHash,
  };
}

function getKlydePrivateSettlementAddress(chainId: number): string {
  const configured = process.env.EXPO_PUBLIC_KLYDE_PRIVACY_SETTLEMENT_ADDRESS;
  if (configured) {
    return configured;
  }

  if (chainId === 31337) {
    return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  }

  throw new Error('EXPO_PUBLIC_KLYDE_PRIVACY_SETTLEMENT_ADDRESS is required for private stablecoin to NGN settlement.');
}

function logPrivateConversionStage(stage: string, metadata: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }

  console.info('[paayee.private_conversion]', {
    stage,
    ...metadata,
  });
}

async function resolvePrivateAssetTokenAddress(assetCode: StablecoinAssetCode, chainId: number): Promise<string> {
  const asset = await resolveKlydeActiveConfidentialAsset(assetCode, chainId);

  if (!asset.tokenAddress) {
    throw new Error(`Klyde has no active ${assetCode} confidential token address for this chain.`);
  }

  return asset.tokenAddress;
}

async function resolveActiveConfidentialBalanceTokenAddress(
  assetCode: StablecoinAssetCode,
  chainId: number,
): Promise<string> {
  const asset = await resolveKlydeActiveConfidentialAsset(assetCode, chainId);

  if (!asset.tokenAddress) {
    throw new Error(`Klyde has no active ${assetCode} confidential token address for this chain.`);
  }

  return asset.tokenAddress;
}

async function resolveKlydeActiveConfidentialAsset(assetCode: StablecoinAssetCode, chainId: number) {
  return resolveKlydeConfidentialAsset({
    chainId,
    mode: KLYDE_ACTIVE_CONFIDENTIAL_MODE,
    underlyingSymbol: assetCode,
  });
}

async function savePrivateOperationEnvelope(envelope: PaayeePrivateOperationEnvelope): Promise<void> {
  await SecureStore.setItemAsync(privateEnvelopeKey(envelope.id), JSON.stringify(envelope));
  await addPrivateOperationEnvelopeToIndex(envelope.id);
}

async function addPrivateOperationEnvelopeToIndex(envelopeId: string): Promise<void> {
  const envelopeIds = await readPrivateOperationEnvelopeIndex();
  const nextEnvelopeIds = [envelopeId, ...envelopeIds.filter((id) => id !== envelopeId)].slice(0, 100);

  await SecureStore.setItemAsync(privateEnvelopeIndexKey, JSON.stringify(nextEnvelopeIds));
}

async function readPrivateOperationEnvelopeIndex(): Promise<string[]> {
  const value = await SecureStore.getItemAsync(privateEnvelopeIndexKey);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function createEncryptedPrivateReceiptMetadata(
  payload: PaayeePrivateReceiptPayload,
  input: {
    chainId: number;
    envelopeId: string;
    ownerAddress: string;
    purpose: string;
  },
): Promise<EncryptedMetadataEnvelope> {
  return encryptMetadataEnvelope({
    aclPolicy: {
      chainId: input.chainId,
      ownerAddress: input.ownerAddress,
      purpose: input.purpose,
    },
    operationId: input.envelopeId,
    payload,
    schemaVersion: 'paayee.private-receipt.v1',
  });
}

async function hydratePrivateOperationEnvelope(
  envelope: PaayeePrivateOperationEnvelope,
): Promise<PaayeePrivateOperationEnvelope> {
  if (!envelope.encryptedMetadataEnvelope) {
    return envelope;
  }

  let payload: PaayeePrivateReceiptPayload;
  try {
    payload = await decryptMetadataEnvelope<PaayeePrivateReceiptPayload>(envelope.encryptedMetadataEnvelope, {
      operationId: envelope.id,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[paayee.private_receipt]', {
        envelopeId: envelope.id,
        message: error instanceof Error ? error.message : String(error),
        stage: 'metadata_decrypt_failed',
      });
    }

    return envelope;
  }

  return {
    ...envelope,
    ...payload,
  };
}

function resolveLocalConfidentialOperationBalance(input: {
  assetCode: StablecoinAssetCode;
  chainId: number;
  confidentialOperations?: KlydeConfidentialOperation[];
  owner?: string;
}): number | undefined {
  if (input.chainId !== 31337 || !input.confidentialOperations?.length) {
    return undefined;
  }

  const owner = input.owner?.toLowerCase();
  const balanceMinorUnits = input.confidentialOperations.reduce((total, operation) => {
    if (operation.status !== 'succeeded' || operation.chainId !== input.chainId) {
      return total;
    }

    if (!operationMatchesStablecoin(operation, input.assetCode)) {
      return total;
    }

    const amountMinorUnits = operationAmountMinorUnits(operation, input.assetCode);
    if (amountMinorUnits === 0n) {
      return total;
    }

    const fromAddress = operation.fromAddress?.toLowerCase();
    const toAddress = operation.toAddress?.toLowerCase();
    const flow = typeof operation.metadata?.paayeePrivacyFlow === 'string' ? operation.metadata.paayeePrivacyFlow : '';

    if (flow === 'private_stablecoin_to_ngn_settlement') {
      return total - amountMinorUnits;
    }

    if (owner && fromAddress === owner && toAddress && toAddress !== owner) {
      return total - amountMinorUnits;
    }

    if (!owner || toAddress === owner || !fromAddress || fromAddress === owner) {
      return total + amountMinorUnits;
    }

    return total;
  }, 0n);

  const numericAmount = Number(balanceMinorUnits) / 10 ** stablecoinScale[input.assetCode];
  if (!Number.isFinite(numericAmount)) {
    return undefined;
  }

  if (__DEV__) {
    console.info('[paayee.confidential.balance]', {
      assetCode: input.assetCode,
      balanceMinorUnits: balanceMinorUnits.toString(),
      event: 'local_operation_history_balance',
    });
  }

  return Math.max(0, numericAmount);
}

function operationMatchesStablecoin(
  operation: KlydeConfidentialOperation,
  assetCode: StablecoinAssetCode,
): boolean {
  const normalizedAssetCode = assetCode.toUpperCase();
  const symbol = operation.symbol.trim().toUpperCase();
  const amountCurrency = operation.amount?.currency.trim().toUpperCase();
  const sourceUnderlyingSymbol =
    typeof operation.metadata?.sourceUnderlyingSymbol === 'string'
      ? operation.metadata.sourceUnderlyingSymbol.trim().toUpperCase()
      : undefined;
  const targetUnderlyingSymbol =
    typeof operation.metadata?.targetUnderlyingSymbol === 'string'
      ? operation.metadata.targetUnderlyingSymbol.trim().toUpperCase()
      : undefined;
  const underlyingSymbol =
    typeof operation.metadata?.underlyingSymbol === 'string'
      ? operation.metadata.underlyingSymbol.trim().toUpperCase()
      : undefined;
  const sourceCurrency =
    typeof operation.metadata?.sourceCurrency === 'string'
      ? operation.metadata.sourceCurrency.trim().toUpperCase()
      : undefined;

  return (
    symbol === `C${normalizedAssetCode}` ||
    amountCurrency === normalizedAssetCode ||
    sourceUnderlyingSymbol === normalizedAssetCode ||
    targetUnderlyingSymbol === normalizedAssetCode ||
    underlyingSymbol === normalizedAssetCode ||
    sourceCurrency === normalizedAssetCode
  );
}

function operationAmountMinorUnits(
  operation: KlydeConfidentialOperation,
  assetCode: StablecoinAssetCode,
): bigint {
  if (!operation.amount || operation.amount.currency.toUpperCase() !== assetCode) {
    return 0n;
  }

  if (operation.amount.minorUnits) {
    return BigInt(operation.amount.minorUnits);
  }

  const displayAmount = Number(String(operation.amount.display ?? '0').replace(/,/g, ''));
  if (!Number.isFinite(displayAmount)) {
    return 0n;
  }

  return BigInt(Math.round(displayAmount * 10 ** (operation.amount.scale ?? stablecoinScale[assetCode])));
}

function privateEnvelopeKey(envelopeId: string): string {
  return `${privateEnvelopeKeyPrefix}${envelopeId}`;
}

function createEnvelopeId(): string {
  return `env_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createLocalNonce(): string {
  return `${Date.now()}:${Math.random().toString(36).slice(2)}:${Math.random().toString(36).slice(2)}`;
}

async function createAmountCommitment(input: {
  amountMinorUnits: string;
  assetCode: StablecoinAssetCode;
  commitmentNonce: string;
  envelopeId: string;
  recipientWalletAddress: string;
  sourceAddress?: string;
}): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    [
      'paayee-private-amount-v1',
      input.assetCode,
      input.amountMinorUnits,
      input.recipientWalletAddress.toLowerCase(),
      input.sourceAddress?.toLowerCase() ?? '',
      input.envelopeId,
      input.commitmentNonce,
    ].join('|'),
  );

  return `0x${digest}`;
}

async function createConversionAmountCommitment(input: {
  amountMinorUnits: string;
  assetCode: SendAssetCode;
  direction: 'source' | 'target';
  envelopeId: string;
  ownerAddress: string;
}): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    [
      'paayee-private-conversion-amount-v1',
      input.direction,
      input.assetCode,
      input.amountMinorUnits,
      input.ownerAddress.toLowerCase(),
      input.envelopeId,
      createLocalNonce(),
    ].join('|'),
  );

  return `0x${digest}`;
}

async function createPairCommitment(input: {
  envelopeId: string;
  sourceAmountCommitment: string;
  targetAmountCommitment: string;
}): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    [
      'paayee-private-conversion-pair-v1',
      input.sourceAmountCommitment,
      input.targetAmountCommitment,
      input.envelopeId,
    ].join('|'),
  );

  return `0x${digest}`;
}

function toMinorUnits(amount: number, assetCode: StablecoinAssetCode): string {
  return String(Math.round(amount * 10 ** stablecoinScale[assetCode]));
}

function toMoneyMinorUnits(amount: number, assetCode: SendAssetCode): string {
  return String(Math.round(amount * 10 ** moneyScale[assetCode]));
}

function toKlydeMoneyAmount(amount: number, assetCode: SendAssetCode, minorUnits: string) {
  return {
    currency: assetCode,
    display: String(amount),
    minorUnits,
    scale: moneyScale[assetCode],
  };
}

function resolvePrivateConversionOperationAmount(input: {
  sourceAmount: number;
  sourceAmountMinorUnits: string;
  sourceAssetCode: SendAssetCode;
  targetAmount: number;
  targetAmountMinorUnits: string;
  targetAssetCode: SendAssetCode;
}) {
  if (input.sourceAssetCode === 'NGN' && isStablecoinAsset(input.targetAssetCode)) {
    return toKlydeMoneyAmount(input.targetAmount, input.targetAssetCode, input.targetAmountMinorUnits);
  }

  return toKlydeMoneyAmount(input.sourceAmount, input.sourceAssetCode, input.sourceAmountMinorUnits);
}

function formatPrivateMoneyAmount(amount: number, assetCode: SendAssetCode): string {
  if (assetCode === 'NGN') {
    return `₦${new Intl.NumberFormat('en-NG', {
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)}`;
  }

  return formatStablecoinAmount(amount, assetCode);
}

function formatStablecoinAmount(amount: number, assetCode: StablecoinAssetCode): string {
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)} ${assetCode}`;
}

function privateConversionFlow(sourceAssetCode: SendAssetCode, targetAssetCode: SendAssetCode): string {
  if (sourceAssetCode === 'NGN' && isStablecoinAsset(targetAssetCode)) {
    return 'ngn_to_private_stablecoin_settlement';
  }

  if (isStablecoinAsset(sourceAssetCode) && targetAssetCode === 'NGN') {
    return 'private_stablecoin_to_ngn_settlement';
  }

  return 'stablecoin_private_conversion';
}

function privateConversionPublicLabel(sourceAssetCode: SendAssetCode, targetAssetCode: SendAssetCode): string {
  if (sourceAssetCode === 'NGN' && isStablecoinAsset(targetAssetCode)) {
    return `NGN to private ${targetAssetCode} settlement`;
  }

  if (isStablecoinAsset(sourceAssetCode) && targetAssetCode === 'NGN') {
    return `Private ${sourceAssetCode} to NGN settlement`;
  }

  return `Private ${sourceAssetCode} to ${targetAssetCode} conversion`;
}
