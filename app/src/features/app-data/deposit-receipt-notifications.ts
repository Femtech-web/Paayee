import * as SecureStore from 'expo-secure-store';

import type { AppTransaction } from './app-data';

const recentDepositWindowMs = 30 * 60 * 1000;
let claimQueue: Promise<unknown> = Promise.resolve();

export function claimDepositReceiptNotification(
  walletAddress: string | undefined,
  transaction: AppTransaction | undefined,
): Promise<boolean> {
  if (
    !walletAddress
    || (transaction?.kind !== 'deposit' && transaction?.kind !== 'private-receive')
    || !transaction.receiptId
  ) {
    return Promise.resolve(false);
  }

  const claim = claimQueue.then(async () => {
    const key = `paayee.seenDepositReceipts.${walletAddress.toLowerCase()}`;
    const seen = await readStringArray(key);
    if (seen.includes(transaction.receiptId!)) return false;

    await SecureStore.setItemAsync(
      key,
      JSON.stringify([transaction.receiptId, ...seen].slice(0, 50)),
    );

    const createdAt = new Date(transaction.createdAt).getTime();
    return Number.isFinite(createdAt) && Date.now() - createdAt <= recentDepositWindowMs;
  });
  claimQueue = claim.catch(() => undefined);
  return claim;
}

async function readStringArray(key: string): Promise<string[]> {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
