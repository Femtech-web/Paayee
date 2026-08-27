import { runtimeConfig } from '@/config/runtime';
import { getSupabaseDataAccessToken } from '@/integrations/supabase/privy-data-token';

export type PaayeeFeeQuote = {
  id: string;
  assetCode: 'USDC' | 'USDT';
  displayAmount: string;
  displayCurrency: 'NGN' | 'USD';
  expiresAt: string;
  feeAssetDisplay: string;
  feeAssetMinorUnits: string;
  collectionEnabled: boolean;
  treasuryAddress?: string;
};

export async function getPaayeeNetworkFeeQuote(input: {
  amountMinorUnits: string;
  assetCode: 'USDC' | 'USDT';
  chainId: number;
  displayCurrency: 'NGN' | 'USD';
  kind: 'shield' | 'unshield' | 'private-send';
}): Promise<PaayeeFeeQuote> {
  if (!runtimeConfig.paayeeApiUrl) throw new Error('Paayee fee quoting is not configured.');
  const token = await getSupabaseDataAccessToken();
  if (!token) throw new Error('Sign in again to refresh your Paayee session.');
  const response = await fetch(`${runtimeConfig.paayeeApiUrl}/v1/wallet/fees/quote`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({})) as PaayeeFeeQuote & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Could not calculate the current network fee.');
  return payload;
}
