import * as SecureStore from 'expo-secure-store';

import { getPaayeeWalletAddress } from '@/features/confidential/zama-mobile-runtime';

export type PaayeeMoneyAmount = {
  currency: string;
  display?: string;
  minorUnits?: string;
  scale?: number;
};

export type PaayeeConfidentialAmountReference = {
  amountCommitment?: string;
  metadataEnvelope?: unknown;
  metadataEnvelopeId?: string;
  operationPublicLabel?: string;
};

export type PaayeeConfidentialOperationStatus = 'prepared' | 'submitted' | 'succeeded' | 'failed';

export type PaayeeConfidentialOperation = {
  amount?: PaayeeMoneyAmount;
  chainId: number;
  completedAt?: string;
  createdAt: string;
  failureReason?: string;
  fromAddress?: string;
  id: string;
  metadata: Record<string, unknown>;
  status: PaayeeConfidentialOperationStatus;
  submittedAt?: string;
  symbol: string;
  toAddress?: string;
  tokenAddress: string;
  transactionHash?: string;
  userOperationHash?: string;
};

const operationKeyPrefix = 'paayee.confidentialOperation.';

export async function getPaayeeWalletAccount() {
  const address = await getPaayeeWalletAddress();
  return {
    user: { id: address.toLowerCase() },
    wallet: { address },
  };
}

export async function preparePaayeeConfidentialOperation(input: {
  amount?: PaayeeMoneyAmount;
  amountReference?: PaayeeConfidentialAmountReference;
  chainId: number;
  fromAddress?: string;
  metadata?: Record<string, unknown>;
  toAddress?: string;
  underlyingSymbol: string;
  [key: string]: unknown;
}, _options?: { idempotencyKey?: string }): Promise<PaayeeConfidentialOperation> {
  const asset = resolvePaayeeConfidentialAsset(input.underlyingSymbol, input.chainId);
  const operation: PaayeeConfidentialOperation = {
    amount: input.amount,
    chainId: input.chainId,
    createdAt: new Date().toISOString(),
    fromAddress: input.fromAddress,
    id: `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    metadata: {
      ...(input.metadata ?? {}),
      amountReference: input.amountReference,
      underlyingSymbol: input.underlyingSymbol,
    },
    status: 'prepared',
    symbol: `c${input.underlyingSymbol}`,
    toAddress: input.toAddress,
    tokenAddress: asset.tokenAddress,
  };
  await saveOperation(operation);
  return operation;
}

export async function markPaayeeConfidentialOperationSubmitted(input: {
  metadata?: Record<string, unknown>;
  operationId: string;
  transactionHash?: string;
  userOperationHash?: string;
}) {
  return updateOperation(input.operationId, {
    metadata: input.metadata,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    transactionHash: input.transactionHash,
    userOperationHash: input.userOperationHash,
  });
}

export async function completePaayeeConfidentialOperation(input: {
  failureReason?: string;
  metadata?: Record<string, unknown>;
  operationId: string;
  status: Extract<PaayeeConfidentialOperationStatus, 'succeeded' | 'failed'>;
  transactionHash?: string;
  userOperationHash?: string;
}) {
  return updateOperation(input.operationId, {
    completedAt: new Date().toISOString(),
    failureReason: input.failureReason,
    metadata: input.metadata,
    status: input.status,
    transactionHash: input.transactionHash,
    userOperationHash: input.userOperationHash,
  });
}

export async function completePaayeeConfidentialSettlement(input: {
  metadata?: Record<string, unknown>;
  operationId: string;
  transactionHash?: string;
  userOperationHash?: string;
  [key: string]: unknown;
}) {
  const operation = await completePaayeeConfidentialOperation({
    metadata: input.metadata,
    operationId: input.operationId,
    status: 'succeeded',
    transactionHash: input.transactionHash,
    userOperationHash: input.userOperationHash,
  });
  return { operation };
}

export function resolvePaayeeConfidentialAsset(underlyingSymbol: string, chainId: number) {
  const normalized = underlyingSymbol.trim().toUpperCase();
  const tokenAddress =
    normalized === 'USDC'
      ? process.env.EXPO_PUBLIC_PAAYEE_CUSDC_ADDRESS
      : normalized === 'USDT'
        ? process.env.EXPO_PUBLIC_PAAYEE_CUSDT_ADDRESS
        : undefined;

  if (!tokenAddress) {
    throw new Error(`Configure EXPO_PUBLIC_PAAYEE_C${normalized}_ADDRESS for chain ${chainId}.`);
  }

  return { tokenAddress };
}

async function updateOperation(
  operationId: string,
  patch: Partial<PaayeeConfidentialOperation> & { metadata?: Record<string, unknown> },
) {
  const current = await readOperation(operationId);
  const operation: PaayeeConfidentialOperation = {
    ...current,
    ...patch,
    metadata: { ...current.metadata, ...(patch.metadata ?? {}) },
  };
  await saveOperation(operation);
  return operation;
}

async function readOperation(operationId: string): Promise<PaayeeConfidentialOperation> {
  const value = await SecureStore.getItemAsync(`${operationKeyPrefix}${operationId}`);
  if (!value) throw new Error(`Private operation ${operationId} was not found on this device.`);
  return JSON.parse(value) as PaayeeConfidentialOperation;
}

async function saveOperation(operation: PaayeeConfidentialOperation) {
  await SecureStore.setItemAsync(`${operationKeyPrefix}${operation.id}`, JSON.stringify(operation));
}
