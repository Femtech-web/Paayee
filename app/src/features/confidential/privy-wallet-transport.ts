import type { ConnectedEthereumWallet, PrivyEmbeddedWalletProvider } from '@privy-io/expo';
import * as SecureStore from 'expo-secure-store';
import { createPublicClient, encodeFunctionData, http, toHex, type Address, type Hex } from 'viem';
import { hardhat, mainnet, sepolia } from 'viem/chains';

import { runtimeConfig } from '@/config/runtime';
import { getSupabaseDataAccessToken } from '@/integrations/supabase/privy-data-token';

import type { PaayeeWalletTransport } from './zama-mobile-runtime';
import { getPaayeeZamaRpcUrl } from './zama-mobile-runtime';

const protectedMetadataKeyPrefix = 'paayee.protectedMetadataKey.';

type PrivyRelayOptions = {
  generateAuthorizationSignature: (input: {
    version: 1;
    method: 'POST';
    url: string;
    headers: {
      'privy-app-id': string;
      'privy-idempotency-key'?: string;
      'privy-request-expiry'?: string;
    };
    body: unknown;
  }) => Promise<{ signature: string }>;
  walletId?: string;
};

export function installPaayeePrivyWalletTransport(wallet: ConnectedEthereumWallet, relay: PrivyRelayOptions): void {
  globalThis.__PAAYEE_WALLET_TRANSPORT__ = createPrivyWalletTransport(wallet, relay);
}

function createPrivyWalletTransport(wallet: ConnectedEthereumWallet, relay: PrivyRelayOptions): PaayeeWalletTransport {
  let providerPromise: Promise<PrivyEmbeddedWalletProvider> | undefined;
  const getProvider = () => (providerPromise ??= wallet.getProvider());
  const chainId = runtimeConfig.zamaChainId;

  return {
    async getAddress() {
      return wallet.address as Address;
    },
    async getChainId() {
      return chainId;
    },
    async protectMetadataKey(input) {
      const keyHandle = createMetadataKeyHandle({
        operationId: input.operationId,
        ownerAddress: wallet.address,
      });
      const aclPolicy = {
        ...input.aclPolicy,
        allowedAddresses: [
          ...new Set([
            wallet.address.toLowerCase(),
            input.aclPolicy.ownerAddress.toLowerCase(),
            ...(input.aclPolicy.allowedAddresses ?? []).map((address) => address.toLowerCase()),
          ]),
        ],
        chainId: input.aclPolicy.chainId ?? chainId,
        mode: 'fhe_acl' as const,
        ownerAddress: input.aclPolicy.ownerAddress.toLowerCase(),
      };

      await SecureStore.setItemAsync(protectedMetadataKeyStorageKey(keyHandle), input.keyBase64);
      return { aclPolicy, keyHandle };
    },
    async unprotectMetadataKey(input) {
      const owner = input.aclPolicy.ownerAddress.toLowerCase();
      const allowed = input.aclPolicy.allowedAddresses?.map((address) => address.toLowerCase()) ?? [];
      if (owner !== wallet.address.toLowerCase() && !allowed.includes(wallet.address.toLowerCase())) {
        throw new Error('This Privy wallet is not authorized to open the private receipt.');
      }

      return (await SecureStore.getItemAsync(protectedMetadataKeyStorageKey(input.keyHandle))) ?? undefined;
    },
    async signTypedData(typedData) {
      const provider = await getProvider();
      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [wallet.address, JSON.stringify(normalizeJsonBody(typedData))],
      });

      return signature as Hex;
    },
    async waitForTransactionReceipt(hash) {
      const publicClient = createPublicClient({
        chain: getViemChain(chainId),
        transport: http(getPaayeeZamaRpcUrl(chainId)),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        logs: receipt.logs.map((log) => ({ data: log.data, topics: log.topics })),
      };
    },
    async writeContract(config) {
      const data = encodeFunctionData({
        abi: config.abi,
        args: config.args,
        functionName: config.functionName,
      } as Parameters<typeof encodeFunctionData>[0]);

      if (runtimeConfig.paayeeApiUrl && relay.walletId) {
        return relaySponsoredTransaction({
          chainId,
          data,
          from: wallet.address,
          generateAuthorizationSignature: relay.generateAuthorizationSignature,
          feeQuoteId: config.paayeeFeeQuoteId,
          to: config.address,
          value: config.value === undefined ? undefined : toHex(config.value),
          walletId: relay.walletId,
        });
      }

      if (runtimeConfig.paayeeApiUrl && chainId !== hardhat.id) {
        throw new Error('Your sponsored Privy wallet is still initializing. Sign out, sign in, and try again.');
      }

      const provider = await getProvider();
      await ensureProviderChain(provider, chainId);
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            chainId: toHex(chainId),
            data,
            from: wallet.address,
            to: config.address,
            value: config.value === undefined ? undefined : toHex(config.value),
          },
        ],
      });

      return hash as Hex;
    },
    async request(args) {
      const publicClient = createPublicClient({
        chain: getViemChain(chainId),
        transport: http(getPaayeeZamaRpcUrl(chainId)),
      });
      return publicClient.request({
        method: args.method as Parameters<typeof publicClient.request>[0]['method'],
        params: args.params as Parameters<typeof publicClient.request>[0]['params'],
      });
    },
  };
}

async function relaySponsoredTransaction(input: {
  chainId: number;
  data: Hex;
  from: string;
  feeQuoteId?: string;
  generateAuthorizationSignature: PrivyRelayOptions['generateAuthorizationSignature'];
  to: string;
  value?: Hex;
  walletId: string;
}): Promise<Hex> {
  const idempotencyKey = `paayee-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const requestExpiry = Date.now() + 60_000;
  const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(input.walletId)}/rpc`;
  const body = {
    method: 'eth_sendTransaction',
    caip2: `eip155:${input.chainId}`,
    chain_type: 'ethereum',
    sponsor: true,
    params: { transaction: { from: input.from, to: input.to, data: input.data, value: input.value ?? '0x0' } },
  };
  const headers = {
    'privy-app-id': runtimeConfig.privyAppId,
    'privy-idempotency-key': idempotencyKey,
    'privy-request-expiry': String(requestExpiry),
  };
  const { signature } = await input.generateAuthorizationSignature({ version: 1, method: 'POST', url, headers, body });
  const token = await getSupabaseDataAccessToken();
  if (!token) throw new Error('Sign in again to refresh your Paayee session.');
  const response = await fetch(`${runtimeConfig.paayeeApiUrl}/v1/wallet/relay`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      authorizationSignature: signature,
      data: input.data,
      feeQuoteId: input.feeQuoteId,
      idempotencyKey,
      requestExpiry,
      to: input.to,
      value: input.value,
      walletAddress: input.from,
      walletId: input.walletId,
    }),
  });
  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    transactionHash?: Hex;
    privyTransactionId?: string;
  };
  if (!response.ok || (!payload.transactionHash && !payload.privyTransactionId)) {
    throw new Error(payload.message ?? 'Paayee could not sponsor this network fee.');
  }
  if (payload.transactionHash) return payload.transactionHash;
  return waitForSponsoredTransaction(payload.privyTransactionId!, token);
}

async function waitForSponsoredTransaction(transactionId: string, token: string): Promise<Hex> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${runtimeConfig.paayeeApiUrl}/v1/wallet/transactions/${encodeURIComponent(transactionId)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const payload = await response.json().catch(() => ({})) as {
      message?: string;
      status?: string;
      transactionHash?: Hex;
    };
    if (!response.ok) throw new Error(payload.message ?? 'Could not check the sponsored transaction.');
    if (payload.transactionHash) return payload.transactionHash;
    if (payload.status === 'failed' || payload.status === 'reverted') {
      throw new Error('The sponsored transaction failed before confirmation.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1_250));
  }
  throw new Error('The sponsored transaction is still pending. Check your activity before trying again.');
}

async function ensureProviderChain(provider: PrivyEmbeddedWalletProvider, chainId: number) {
  const currentChainId = await provider.request({ method: 'eth_chainId' });
  if (Number(currentChainId) === chainId) {
    return;
  }

  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: toHex(chainId) }],
  });
}

function createMetadataKeyHandle(input: { operationId?: string; ownerAddress: string }): string {
  return [
    'privy-fhe-acl-key',
    input.ownerAddress.toLowerCase(),
    input.operationId ?? Date.now().toString(36),
    Math.random().toString(36).slice(2, 12),
  ].join(':');
}

function protectedMetadataKeyStorageKey(keyHandle: string): string {
  return `${protectedMetadataKeyPrefix}${keyHandle.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function getViemChain(chainId: number) {
  if (chainId === hardhat.id) return hardhat;
  if (chainId === mainnet.id) return mainnet;
  return sepolia;
}

function normalizeJsonBody(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeJsonBody);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJsonBody(item)]));
  }
  return value;
}
