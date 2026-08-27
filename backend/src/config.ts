import { Injectable } from '@nestjs/common';

export type AssetSymbol = 'USDC' | 'USDT';

export type AssetConfig = {
  symbol: AssetSymbol;
  publicAddress: `0x${string}`;
  confidentialAddress: `0x${string}`;
  decimals: number;
  startBlock: bigint;
};

@Injectable()
export class AppConfig {
  readonly port = numberEnv('PORT', 3000);
  readonly corsOrigin = process.env.PAAYEE_CORS_ORIGIN?.trim() || '*';
  readonly supabaseUrl = requiredEnv('SUPABASE_URL');
  readonly supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  readonly supabaseJwtSecret = requiredEnv('PAAYEE_SUPABASE_JWT_SECRET');
  readonly chainId = numberEnv('PAAYEE_CHAIN_ID', 11155111);
  readonly networkName = process.env.PAAYEE_NETWORK_NAME?.trim() || 'sepolia';
  readonly rpcUrl = requiredEnv('PAAYEE_RPC_URL');
  readonly privyAppId = requiredEnv('PRIVY_APP_ID');
  readonly privyAppSecret = requiredEnv('PRIVY_APP_SECRET');
  readonly confirmations = numberEnv('PAAYEE_CONFIRMATIONS', 2);
  readonly conversionFeeBps = numberEnv('PAAYEE_CONVERSION_FEE_BPS', 50);
  readonly fallbackEthUsd = positiveNumberEnv('PAAYEE_FALLBACK_ETH_USD', 4_500);
  readonly maxSponsoredFeeUsd = positiveNumberEnv('PAAYEE_MAX_SPONSORED_FEE_USD', 2);
  readonly maxSponsoredGasUnits = {
    shield: BigInt(numberEnv('PAAYEE_MAX_SHIELD_GAS_UNITS', 800_000)),
    unshield: BigInt(numberEnv('PAAYEE_MAX_UNSHIELD_GAS_UNITS', 1_200_000)),
    'public-send': BigInt(numberEnv('PAAYEE_MAX_PUBLIC_SEND_GAS_UNITS', 150_000)),
    'private-send': BigInt(numberEnv('PAAYEE_MAX_PRIVATE_SEND_GAS_UNITS', 800_000)),
  } as const;
  readonly fallbackNgnPerUsd = positiveNumberEnv('PAAYEE_FALLBACK_NGN_PER_USD', 1485);
  readonly intervalMs = numberEnv('PAAYEE_INDEXER_INTERVAL_MS', 10_000);
  readonly lookbackBlocks = BigInt(numberEnv('PAAYEE_INDEXER_LOOKBACK_BLOCKS', 200));
  readonly indexerDriver = process.env.PAAYEE_INDEXER_DRIVER === 'subgraph' ? 'subgraph' : 'rpc';
  readonly subgraphUrl = process.env.PAAYEE_SUBGRAPH_URL?.trim();
  readonly assets: AssetConfig[] = [
    {
      symbol: 'USDC',
      publicAddress: addressEnv('PAAYEE_USDC_ADDRESS'),
      confidentialAddress: addressEnv('PAAYEE_CUSDC_ADDRESS'),
      decimals: 6,
      startBlock: BigInt(numberEnv('PAAYEE_USDC_START_BLOCK', 11222608)),
    },
    {
      symbol: 'USDT',
      publicAddress: addressEnv('PAAYEE_USDT_ADDRESS'),
      confidentialAddress: addressEnv('PAAYEE_CUSDT_ADDRESS'),
      decimals: 6,
      startBlock: BigInt(numberEnv('PAAYEE_USDT_START_BLOCK', 11222609)),
    },
  ];
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function positiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
  return value;
}

function addressEnv(name: string): `0x${string}` {
  const value = requiredEnv(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${name} must be an EVM address`);
  return value as `0x${string}`;
}
