import type { MoneyAmount, WithdrawalDestination } from '@/integrations/klyde';
import {
  createKlydeInternalTransfer,
  createKlydeWithdrawal,
  quoteKlydeWithdrawal,
} from '@/integrations/klyde';
import { runtimeConfig } from '@/config/runtime';
import { getKlydeConfig } from '@/integrations/klyde/env';
import {
  isStablecoinAsset,
  preparePaayeePrivateStablecoinSend,
  type PaayeePrivateSendResult,
} from '@/features/confidential/confidential-money';

import type { SendAssetCode, SendRecipient, StablecoinNetworkOption } from './send-data';

export type LiveSendMethod = 'bank' | 'handle' | 'stablecoin';

type CreateLiveSendInput = {
  amount: number;
  assetCode: SendAssetCode;
  method: LiveSendMethod;
  narration?: string;
  network?: StablecoinNetworkOption;
  purpose?: string;
  recipient: SendRecipient;
};

const moneyScaleByAsset: Record<SendAssetCode, number> = {
  NGN: 2,
  USDC: 6,
  USDT: 6,
};

export async function createLiveSend(input: CreateLiveSendInput) {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  const amount = toKlydeMoneyAmount(input.amount, input.assetCode);

  if (isStablecoinAsset(input.assetCode) && (input.method === 'handle' || input.method === 'stablecoin')) {
    const walletAddress = input.method === 'stablecoin' ? input.recipient.accountNumber : input.recipient.walletAddress;

    if (!walletAddress) {
      throw new Error('This recipient is not linked to a confidential token destination yet.');
    }

    return preparePaayeePrivateStablecoinSend({
      amount: input.amount,
      assetCode: input.assetCode,
      chainId: readWithdrawalChainId(input) ?? 31337,
      narration: input.narration,
      purpose: input.purpose,
      recipient: {
        handle: input.recipient.handle,
        name: input.recipient.name,
        walletAddress,
      },
      sendMethod: input.method,
    });
  }

  if (input.method === 'handle') {
    if (!input.recipient.walletAddress) {
      throw new Error('This Paayee handle is not linked to a transfer destination yet.');
    }

    return createKlydeInternalTransfer(
      {
        amount,
        metadata: {
          narration: input.narration?.trim() || undefined,
          paayeeHandle: input.recipient.handle,
          paayeePurpose: input.purpose,
          recipientName: input.recipient.name,
          recipientWalletAddress: input.recipient.walletAddress,
          sendMethod: input.method,
        },
        recipient: {
          address: input.recipient.walletAddress,
          chainId: readWithdrawalChainId(input),
          type: 'wallet',
        },
      },
      {
        idempotencyKey: `paayee-handle-send-${Date.now()}`,
      },
    );
  }

  const destination = toKlydeWithdrawalDestination(input);
  const quote = await quoteKlydeWithdrawal({
    amount,
    destination,
    market: 'NG',
    settlementAsset: {
      symbol: input.assetCode,
      chainId: readWithdrawalChainId(input),
    },
  });

  return createKlydeWithdrawal(
    {
      destination,
      metadata: {
        narration: input.narration?.trim() || undefined,
        paayeePurpose: input.purpose,
        recipientName: input.recipient.name,
        sendMethod: input.method,
      },
      quoteId: quote.id,
    },
    {
      idempotencyKey: `paayee-send-${Date.now()}`,
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

function toKlydeWithdrawalDestination(input: CreateLiveSendInput): WithdrawalDestination {
  if (input.method === 'bank') {
    return {
      accountReference: input.recipient.bankCode
        ? `${input.recipient.bankCode}:${input.recipient.accountNumber}:${input.recipient.name}`
        : input.recipient.accountNumber,
      bankName: input.recipient.bankName,
      type: 'bank_account',
    };
  }

  if (input.method === 'stablecoin') {
    return {
      address: input.recipient.accountNumber,
      chainId: input.network?.chainId,
      type: 'wallet',
    };
  }

  if (input.recipient.walletAddress) {
    return {
      address: input.recipient.walletAddress,
      chainId: readWithdrawalChainId(input),
      type: 'wallet',
    };
  }

  throw new Error('This Paayee handle is not linked to a transfer destination yet.');
}

function readWithdrawalChainId(input: CreateLiveSendInput): number | undefined {
  if (input.network?.chainId) {
    return input.network.chainId;
  }

  if (input.method === 'handle') {
    return getKlydeConfig().environment === 'production' ? 11155111 : 31337;
  }

  return undefined;
}

export function isPrivateSendResult(value: unknown): value is PaayeePrivateSendResult {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { kind?: unknown }).kind === 'app_managed_confidential_operation'
  );
}
