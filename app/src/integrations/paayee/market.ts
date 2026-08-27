import type { KlydeQuote, KlydeRates } from '@/integrations/klyde';
import { runtimeConfig } from '@/config/runtime';
import { getSupabaseDataAccessToken } from '@/integrations/supabase/privy-data-token';

export async function getPaayeeRates(baseCurrency: 'NGN' | 'USD' = 'NGN'): Promise<KlydeRates> {
  return request<KlydeRates>(`/v1/market/rates?base=${baseCurrency}`);
}

export async function quotePaayeeConversion(input: {
  amount: number;
  sourceCurrency: 'NGN' | 'USDC' | 'USDT';
  targetCurrency: 'NGN' | 'USDC' | 'USDT';
}): Promise<KlydeQuote> {
  return request<KlydeQuote>('/v1/market/quotes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!runtimeConfig.paayeeApiUrl) throw new Error('Paayee API is not configured.');
  const token = await getSupabaseDataAccessToken();
  if (!token) throw new Error('Sign in again to refresh your Paayee session.');
  const response = await fetch(`${runtimeConfig.paayeeApiUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'Paayee market data is unavailable.');
  return body;
}
