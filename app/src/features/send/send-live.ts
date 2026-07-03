import type { MoneyAmount, WithdrawalDestination } from '@/integrations/klyde';
import { createKlydeWithdrawal, quoteKlydeWithdrawal } from '@/integrations/klyde';
import { runtimeConfig } from '@/config/runtime';

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
  const destination = toKlydeWithdrawalDestination(input);
  const quote = await quoteKlydeWithdrawal({
    amount,
    destination,
    market: 'NG',
    settlementAsset: {
      symbol: input.assetCode,
      chainId: input.network?.chainId,
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
      accountReference: input.recipient.accountNumber,
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
      chainId: 11155111,
      type: 'wallet',
    };
  }

  throw new Error('This Paayee handle is not linked to a transfer destination yet.');
}
