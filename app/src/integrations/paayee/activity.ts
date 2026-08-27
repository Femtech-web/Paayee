import { runtimeConfig } from '@/config/runtime';
import { getSupabaseDataAccessToken } from '@/integrations/supabase/privy-data-token';

export type PaayeeChainActivity = {
  deposits: PaayeeDeposit[];
  operations: PaayeeOperation[];
  privateTransfers: PaayeePrivateTransfer[];
  receipts: PaayeeReceipt[];
};

export type PaayeeDeposit = {
  id: string;
  amount_minor_units: string;
  confirmations: number;
  created_at: string;
  status: 'detected' | 'confirming' | 'confirmed' | 'reorged';
  token_symbol: 'USDC' | 'USDT';
  transaction_hash: string;
};

export type PaayeeOperation = {
  id: string;
  amount_minor_units: string;
  created_at: string;
  destination_address?: string;
  kind: 'shield' | 'unshield' | 'public_send';
  status: 'submitted' | 'confirmed' | 'failed';
  token_symbol: 'USDC' | 'USDT';
  transaction_hash: string;
};

export type PaayeePrivateTransfer = {
  id: string;
  confirmations: number;
  created_at: string;
  encrypted_amount_handle: string;
  from_address: string;
  sender_handle?: string;
  sender_name?: string;
  status: 'detected' | 'confirming' | 'confirmed' | 'reorged';
  token_symbol: 'USDC' | 'USDT';
  transaction_hash: string;
};

export type PaayeeReceipt = {
  id: string;
  amount_minor_units?: string;
  created_at: string;
  deposit_id?: string;
  detail: string;
  encrypted_amount_handle?: string;
  operation_id?: string;
  private_transfer_id?: string;
  receipt_type: 'deposit' | 'shield' | 'unshield' | 'send' | 'private_receive';
  from_address?: string;
  sender_handle?: string;
  sender_name?: string;
  status: 'confirmed' | 'failed';
  title: string;
  token_decimals?: number;
  token_symbol?: 'USDC' | 'USDT';
  transaction_hash?: string;
};

export async function getPaayeeChainActivity(symbol?: 'USDC' | 'USDT'): Promise<PaayeeChainActivity> {
  if (!runtimeConfig.paayeeApiUrl) return { deposits: [], operations: [], privateTransfers: [], receipts: [] };
  const suffix = symbol ? `?symbol=${symbol}` : '';
  return request<PaayeeChainActivity>(`/v1/activity${suffix}`);
}

export async function getPaayeeActivityReceipt(receiptId: string): Promise<PaayeeReceipt> {
  return request<PaayeeReceipt>(`/v1/activity/receipts/${encodeURIComponent(receiptId)}`);
}

export async function recordPaayeePrivacyOperation(input: {
  amountMinorUnits: string;
  chainId: number;
  confidentialTokenAddress: string;
  kind: 'shield' | 'unshield';
  publicTokenAddress: string;
  tokenSymbol: 'USDC' | 'USDT';
  transactionHash: string;
}): Promise<PaayeeOperation | undefined> {
  if (!runtimeConfig.paayeeApiUrl) return undefined;
  return request<PaayeeOperation>('/v1/activity/operations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function recordPaayeeStablecoinSend(input: {
  amountMinorUnits: string;
  chainId: number;
  confidentialTokenAddress: string;
  destinationAddress: string;
  publicTokenAddress: string;
  tokenSymbol: 'USDC' | 'USDT';
  transactionHash: string;
}): Promise<PaayeeOperation | undefined> {
  if (!runtimeConfig.paayeeApiUrl) return undefined;
  return request<PaayeeOperation>('/v1/activity/operations', {
    method: 'POST',
    body: JSON.stringify({
      amountMinorUnits: input.amountMinorUnits,
      chainId: input.chainId,
      confidentialTokenAddress: input.confidentialTokenAddress,
      destinationAddress: input.destinationAddress,
      kind: 'public_send',
      publicTokenAddress: input.publicTokenAddress,
      tokenSymbol: input.tokenSymbol,
      transactionHash: input.transactionHash,
    }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  if (!response.ok) throw new Error(body.message ?? 'Paayee activity is unavailable.');
  return body;
}
