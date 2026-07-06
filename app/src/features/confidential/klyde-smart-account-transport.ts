import { createPublicClient, encodeFunctionData, http, type Address, type Hex } from 'viem';
import { hardhat, mainnet, sepolia } from 'viem/chains';
import * as SecureStore from 'expo-secure-store';

import { runtimeConfig } from '@/config/runtime';
import {
  createKlydeAutoShieldPolicy,
  getKlydeUser,
  getKlydeWallet,
  listKlydeAutoShieldPolicies,
  sendKlydeCurrentWalletTransaction,
  signKlydeCurrentWalletTypedData,
} from '@/integrations/klyde';
import { getKlydeConfig } from '@/integrations/klyde/env';

import type { PaayeeSmartAccountTransport } from './zama-mobile-runtime';
import { getPaayeeZamaRpcUrl } from './zama-mobile-runtime';

let installed = false;
let autoShieldPolicyPromise: Promise<void> | undefined;
let cachedWallet:
  | {
      address: Address;
      chainId: number;
      loadedAt: number;
    }
  | undefined;
let walletPromise: Promise<{ address: Address; chainId: number }> | undefined;
const walletCacheTtlMs = 30_000;
const protectedMetadataKeyPrefix = 'paayee.protectedMetadataKey.';

export function installPaayeeKlydeSmartAccountTransport(): void {
  if (installed) {
    return;
  }

  globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__ = createKlydeSmartAccountTransport();
  autoShieldPolicyPromise = ensurePaayeeAutoShieldPolicy().catch((error) => {
    console.warn('[paayee.confidential.auto_shield_policy]', {
      event: 'ensure_failed',
      reason: error instanceof Error ? error.message : String(error),
    });
  });
  installed = true;
}

function createKlydeSmartAccountTransport(): PaayeeSmartAccountTransport {
  return {
    async getAddress() {
      const wallet = await getCachedKlydeWallet();

      return wallet.address;
    },
    async getChainId() {
      const wallet = await getCachedKlydeWallet();

      return wallet.chainId;
    },
    async protectMetadataKey(input) {
      const wallet = await getCachedKlydeWallet();
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
        chainId: input.aclPolicy.chainId ?? wallet.chainId,
        mode: 'fhe_acl' as const,
        ownerAddress: input.aclPolicy.ownerAddress.toLowerCase(),
      };

      // Local mobile builds use SecureStore as the key-custody persistence layer while the handle keeps
      // the same ACL-shaped contract as production FHE key protection.
      await SecureStore.setItemAsync(protectedMetadataKeyStorageKey(keyHandle), input.keyBase64);

      return {
        aclPolicy,
        keyHandle,
      };
    },
    async unprotectMetadataKey(input) {
      return (await SecureStore.getItemAsync(protectedMetadataKeyStorageKey(input.keyHandle))) ?? undefined;
    },
    async signTypedData(typedData) {
      const wallet = await getCachedKlydeWallet();
      try {
        const result = await signKlydeCurrentWalletTypedData({
          chainId: wallet.chainId,
          typedData: normalizeJsonBody(typedData) as Record<string, unknown>,
        });

        console.info('[paayee.confidential.sign_typed_data]', {
          address: shortenAddressForLog(result.address),
          event: 'signed',
          primaryType: (typedData as { primaryType?: unknown }).primaryType,
          signature: `${result.signature.slice(0, 10)}...`,
        });

        return result.signature as Hex;
      } catch (error) {
        console.warn('[paayee.confidential.sign_typed_data]', {
          event: 'failed',
          primaryType: (typedData as { primaryType?: unknown }).primaryType,
          reason: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    async waitForTransactionReceipt(hash) {
      const chainId = await this.getChainId();
      const publicClient = createPublicClient({
        chain: getViemChain(chainId),
        transport: http(getPaayeeZamaRpcUrl(chainId)),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        logs: receipt.logs.map((log) => ({
          data: log.data,
          topics: log.topics,
        })),
      };
    },
    async writeContract(config) {
      const chainId = await this.getChainId();
      const data = encodeFunctionData({
        abi: config.abi,
        args: config.args,
        functionName: config.functionName,
      } as Parameters<typeof encodeFunctionData>[0]);
      const result = await sendKlydeCurrentWalletTransaction({
        chainId,
        data,
        to: config.address as Hex,
        value: config.value === undefined ? undefined : String(config.value),
      });

      return result.hash as Hex;
    },
    async request(args) {
      const chainId = await this.getChainId();
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

function createMetadataKeyHandle(input: { operationId?: string; ownerAddress: string }): string {
  return [
    'local-fhe-acl-key',
    input.ownerAddress.toLowerCase(),
    input.operationId ?? Date.now().toString(36),
    Math.random().toString(36).slice(2, 12),
  ].join(':');
}

function protectedMetadataKeyStorageKey(keyHandle: string): string {
  return `${protectedMetadataKeyPrefix}${keyHandle.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function shortenAddressForLog(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

async function getCachedKlydeWallet(): Promise<{ address: Address; chainId: number }> {
  const now = Date.now();
  if (cachedWallet && now - cachedWallet.loadedAt < walletCacheTtlMs) {
    return cachedWallet;
  }

  walletPromise ??= getKlydeWallet()
    .then((wallet) => {
      const cached = {
        address: wallet.address as Address,
        chainId: wallet.chainId ?? getDefaultPrivacyChainId(),
        loadedAt: Date.now(),
      };
      cachedWallet = cached;

      return {
        address: cached.address,
        chainId: cached.chainId,
      };
    })
    .finally(() => {
      walletPromise = undefined;
    });

  return walletPromise;
}

async function ensurePaayeeAutoShieldPolicy(): Promise<void> {
  if (!runtimeConfig.realIntegrationsEnabled || !runtimeConfig.zamaMobileRuntimeEnabled) {
    return;
  }

  if (!runtimeConfig.paayeeAutoShieldPolicyEnabled) {
    return;
  }

  if (autoShieldPolicyPromise) {
    return autoShieldPolicyPromise;
  }

  const [user, wallet] = await Promise.all([getKlydeUser(), getCachedKlydeWallet()]);
  const chainId = wallet.chainId;
  const policies = await listKlydeAutoShieldPolicies({ userId: user.id, page: 1, pageSize: 20 });
  const hasPolicy = policies.some((policy) => {
    if (policy.status !== 'active') {
      return false;
    }

    const supportsChain = policy.allowedChainIds.includes(chainId);
    const supportsStablecoins =
      policy.allowedUnderlyingSymbols.length === 0 ||
      (policy.allowedUnderlyingSymbols.includes('USDC') && policy.allowedUnderlyingSymbols.includes('USDT'));

    return supportsChain && supportsStablecoins;
  });

  if (hasPolicy) {
    return;
  }

  await createKlydeAutoShieldPolicy({
    userId: user.id,
    consentReference: `paayee_auto_shield_${chainId}_${wallet.address.toLowerCase()}`,
    operatorAddress: wallet.address,
    allowedChainIds: [chainId],
    allowedUnderlyingSymbols: ['USDC', 'USDT'],
    dailyLimitMinorUnits: '1000000000000',
    metadata: {
      source: 'paayee_mobile_runtime',
      consentSurface: 'local_private_funding_default',
      createdBy: 'paayee_app',
    },
  });

  console.info('[paayee.confidential.auto_shield_policy]', {
    event: 'created',
    chainId,
    userId: user.id,
  });
}

function getDefaultPrivacyChainId(): number {
  return getKlydeConfig().environment === 'production' ? sepolia.id : hardhat.id;
}

function getViemChain(chainId: number) {
  if (chainId === hardhat.id) {
    return hardhat;
  }

  if (chainId === mainnet.id) {
    return mainnet;
  }

  return sepolia;
}

function normalizeJsonBody(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonBody(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeJsonBody(item)]),
    );
  }

  return value;
}
