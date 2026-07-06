import './zama-runtime-polyfills';

import {
  DecryptionFailedError,
  TransactionRevertedError,
  WalletNotConnectedError,
  ZamaSDK,
  createConfig,
  createWalletAccountStore,
  memoryStorage,
  type ContractAbi,
  type EIP712TypedData,
  type FheChain,
  type GenericProvider,
  type GenericSigner,
  type ReadContractArgs,
  type ReadContractConfig,
  type ReadContractReturnType,
  type ReadFunctionName,
  type TransactionReceipt,
  type TransactionResult,
  type WalletAccount,
  type WalletAccountStore,
  type WriteContractArgs,
  type WriteContractConfig,
  type WriteFunctionName,
} from '@zama-fhe/sdk';
import { RelayerCleartext } from '@zama-fhe/sdk/cleartext';
import { hardhat as zamaHardhat, mainnet as zamaMainnet, sepolia as zamaSepolia } from '@zama-fhe/sdk/chains';
import { web } from '@zama-fhe/sdk/web';
import {
  concat,
  createPublicClient,
  decodeEventLog,
  encodePacked,
  http,
  isAddress,
  parseAbiItem,
  slice,
  toHex,
  type Address,
  type Chain,
  type Hex,
} from 'viem';
import { hardhat, mainnet, sepolia } from 'viem/chains';
import Constants from 'expo-constants';

import { getKlydeConfig } from '@/integrations/klyde/env';

const HARDHAT_FHEVM_USER_DECRYPT = 'fhevm_relayer_v1_user_decrypt';
const HARDHAT_FHEVM_PUBLIC_DECRYPT = 'fhevm_relayer_v1_public_decrypt';
const HARDHAT_PUBLIC_DECRYPT_EXTRA_DATA = '0x00' as const;

type PaayeeConfidentialToken = {
  balanceOf?: (owner: Address) => Promise<bigint>;
  confidentialBalanceOf?: (owner: Address) => Promise<string>;
  confidentialTransfer?: (
    recipient: Address,
    amount: bigint,
    options?: { skipBalanceCheck?: boolean },
  ) => Promise<TransactionResult | unknown>;
  unshield?: (
    amount: bigint,
    options?: { skipBalanceCheck?: boolean },
  ) => Promise<TransactionResult | unknown>;
  unwrap?: (amount: bigint) => Promise<TransactionResult | unknown>;
  finalizeUnwrap?: (unwrapRequestId: Hex) => Promise<TransactionResult | unknown>;
};

export type PaayeeSmartAccountTransport = {
  executeConfidentialConversion?: (input: {
    operationId: string;
    sourceAmountMinorUnits: string;
    sourceTokenAddress: Address;
    targetAmountMinorUnits: string;
    targetTokenAddress: Address;
  }) => Promise<PaayeeConfidentialTransferResult>;
  protectMetadataKey?: (input: {
    aclPolicy: PaayeeMetadataAclPolicy;
    keyBase64: string;
    operationId?: string;
  }) => Promise<PaayeeProtectedMetadataKey>;
  getAddress: () => Promise<Address>;
  getChainId: () => Promise<number>;
  readContract?: <
    const TAbi extends ContractAbi,
    TFunctionName extends ReadFunctionName<TAbi>,
    const TArgs extends ReadContractArgs<TAbi, TFunctionName>,
  >(
    config: ReadContractConfig<TAbi, TFunctionName, TArgs>,
  ) => Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs>>;
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  signTypedData: (typedData: EIP712TypedData) => Promise<Hex>;
  unprotectMetadataKey?: (input: {
    aclPolicy: PaayeeMetadataAclPolicy;
    keyHandle: string;
  }) => Promise<string | undefined>;
  waitForTransactionReceipt?: (hash: Hex) => Promise<TransactionReceipt>;
  writeContract: <
    const TAbi extends ContractAbi,
    TFunctionName extends WriteFunctionName<TAbi>,
    const TArgs extends WriteContractArgs<TAbi, TFunctionName>,
  >(
    config: WriteContractConfig<TAbi, TFunctionName, TArgs>,
  ) => Promise<Hex>;
};

export type PaayeeConfidentialTransferResult = {
  receipt?: TransactionReceipt;
  transactionHash?: Hex;
  userOperationHash?: Hex;
};

export type PaayeeMetadataAclPolicy = {
  allowedAddresses?: string[];
  chainId?: number;
  keyContractAddress?: string;
  mode: 'fhe_acl';
  ownerAddress: string;
  purpose?: string;
};

export type PaayeeProtectedMetadataKey = {
  aclPolicy: PaayeeMetadataAclPolicy;
  keyHandle: string;
};

declare global {
  // The native/smart-account layer should attach this object after the user unlocks Paayee.
  // It must route writes through the user's Klyde smart account, not an Expo-held private key.
  var __PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__: PaayeeSmartAccountTransport | undefined;
}

const viemChainById: Record<number, Chain> = {
  [hardhat.id]: hardhat,
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
};

let sdkCache: { chainId: number; sdk: Promise<ZamaSDK> } | undefined;

export async function executePaayeeConfidentialTransfer(input: {
  amountMinorUnits: string;
  chainId: number;
  recipient: string;
  tokenAddress: string;
}): Promise<PaayeeConfidentialTransferResult> {
  const sdk = await getPaayeeZamaSdk(input.chainId);
  const token = createPaayeeConfidentialToken(sdk, input.tokenAddress as Address);

  if (!token.confidentialTransfer) {
    throw new Error('Zama SDK token does not expose confidentialTransfer in this mobile runtime.');
  }

  const result = await token.confidentialTransfer(input.recipient as Address, BigInt(input.amountMinorUnits), {
    skipBalanceCheck: true,
  });

  return normalizeTransactionResult(result);
}

export async function executePaayeeConfidentialConversion(input: {
  operationId: string;
  sourceAmountMinorUnits: string;
  sourceTokenAddress: string;
  targetAmountMinorUnits: string;
  targetTokenAddress: string;
}): Promise<PaayeeConfidentialTransferResult> {
  const transport = getSmartAccountTransport();

  if (!transport.executeConfidentialConversion) {
    throw new Error(
      'Paayee confidential conversion executor is not configured yet. Add it to the Klyde smart-account transport before enabling private conversion execution.',
    );
  }

  return transport.executeConfidentialConversion({
    operationId: input.operationId,
    sourceAmountMinorUnits: input.sourceAmountMinorUnits,
    sourceTokenAddress: input.sourceTokenAddress as Address,
    targetAmountMinorUnits: input.targetAmountMinorUnits,
    targetTokenAddress: input.targetTokenAddress as Address,
  });
}

export async function executePaayeeConfidentialUnshield(input: {
  amountMinorUnits: string;
  chainId: number;
  tokenAddress: string;
}): Promise<PaayeeConfidentialTransferResult> {
  const sdk = await getPaayeeZamaSdk(input.chainId);
  const token = createPaayeeConfidentialToken(sdk, input.tokenAddress as Address);

  if (token.unwrap && token.finalizeUnwrap) {
    return executeKlydeCompatibleUnshield({
      amountMinorUnits: input.amountMinorUnits,
      chainId: input.chainId,
      token,
      tokenAddress: input.tokenAddress as Address,
    });
  }

  if (!token.unshield) {
    throw new Error('Zama SDK token does not expose unshield in this mobile runtime.');
  }

  const result = await token.unshield(BigInt(input.amountMinorUnits), {
    skipBalanceCheck: true,
  });

  return normalizeTransactionResult(result);
}

async function executeKlydeCompatibleUnshield(input: {
  amountMinorUnits: string;
  chainId: number;
  token: PaayeeConfidentialToken;
  tokenAddress: Address;
}): Promise<PaayeeConfidentialTransferResult> {
  if (!input.token.unwrap || !input.token.finalizeUnwrap) {
    throw new Error('Zama SDK token does not expose two-phase unwrap in this mobile runtime.');
  }

  const unwrapResult = await input.token.unwrap(BigInt(input.amountMinorUnits));
  const normalizedUnwrap = normalizeTransactionResult(unwrapResult);
  const unwrapReceipt = await resolveTransactionReceipt(normalizedUnwrap);
  const unwrapAmountHandle = findKlydeUnwrapAmountHandle(unwrapReceipt);

  if (__DEV__) {
    console.info('[paayee.confidential.unshield]', {
      stage: 'unwrap_requested',
      transactionHash: normalizedUnwrap.transactionHash,
      unwrapAmountHandle,
    });
  }

  const finalizeResult = await input.token.finalizeUnwrap(unwrapAmountHandle);
  const normalizedFinalize = normalizeTransactionResult(finalizeResult);

  if (__DEV__) {
    console.info('[paayee.confidential.unshield]', {
      stage: 'unwrap_finalized',
      transactionHash: normalizedFinalize.transactionHash,
    });
  }

  return normalizedFinalize;
}

type HardhatUserDecryptParams = Parameters<RelayerCleartext['userDecrypt']>[0];
type HardhatPublicDecryptResult = Awaited<ReturnType<RelayerCleartext['publicDecrypt']>>;

/**
 * Bridges Zama SDK cleartext encryption to the @fhevm/hardhat-plugin mock relayer RPC.
 * The SDK cleartext relayer reads `executor.plaintexts`, but Hardhat mock FHEVM stores
 * computed handles in `fhevm_relayer_v1_*` JSON-RPC methods instead.
 */
class PaayeeHardhatFhevmCleartextRelayer extends RelayerCleartext {
  private readonly chainId: number;
  private readonly rpcUrl: string;

  constructor(chain: FheChain) {
    super(chain);
    this.chainId = chain.id;
    this.rpcUrl = typeof chain.network === 'string' ? chain.network : getRpcUrl(chain.id);
  }

  override async userDecrypt(
    params: HardhatUserDecryptParams,
  ): Promise<Awaited<ReturnType<RelayerCleartext['userDecrypt']>>> {
    const encryptedValues = resolveUserDecryptEncryptedValues(params);

    try {
      const response = await hardhatJsonRpc<HardhatMockUserDecryptResponse>(this.rpcUrl, HARDHAT_FHEVM_USER_DECRYPT, [
        {
          contractAddresses: params.signedContractAddresses,
          contractsChainId: String(this.chainId),
          extraData: HARDHAT_PUBLIC_DECRYPT_EXTRA_DATA,
          handleContractPairs: encryptedValues.map((handle) => ({
            contractAddress: params.contractAddress,
            handle,
          })),
          publicKey: stripHexPrefix(params.publicKey),
          requestValidity: {
            durationDays: String(params.durationDays),
            startTimestamp: String(params.startTimestamp),
          },
          signature: stripHexPrefix(params.signature),
          userAddress: params.signerAddress,
        },
      ]);

      const decryptedValues = response.payload.decrypted_values;
      if (decryptedValues.length !== encryptedValues.length) {
        throw new DecryptionFailedError('Hardhat mock user decrypt returned an unexpected number of values');
      }

      return Object.fromEntries(
        encryptedValues.map((handle, index) => [
          handle,
          decodeHardhatMockCleartext(
            handle,
            parseHardhatMockDecryptedScalar(handle, decryptedValues[index]!),
          ),
        ]),
      );
    } catch (error) {
      if (shouldFallbackToSdkCleartextRelayer(error)) {
        return super.userDecrypt(params);
      }

      throw error;
    }
  }

  override async publicDecrypt(encryptedValues: string[]): Promise<HardhatPublicDecryptResult> {
    if (encryptedValues.length === 0) {
      return { abiEncodedClearValues: '0x', clearValues: {}, decryptionProof: '0x' };
    }

    try {
      const response = await hardhatJsonRpc<HardhatMockPublicDecryptResponse>(
        this.rpcUrl,
        HARDHAT_FHEVM_PUBLIC_DECRYPT,
        [
          {
            ciphertextHandles: encryptedValues,
            extraData: HARDHAT_PUBLIC_DECRYPT_EXTRA_DATA,
          },
        ],
      );

      const abiEncodedClearValues = normalizeHex(response.decrypted_value);
      const clearValues = Object.fromEntries(
        encryptedValues.map((handle, index) => [
          handle,
          decodeHardhatMockCleartext(
            handle,
            parseHardhatMockDecryptedScalar(handle, slice(abiEncodedClearValues, index * 32, (index + 1) * 32)),
          ),
        ]),
      );
      const signatures = response.signatures.map(normalizeHex);
      const decryptionProof = buildHardhatMockDecryptionProof(signatures);

      return {
        abiEncodedClearValues,
        clearValues,
        decryptionProof,
      };
    } catch (error) {
      if (shouldFallbackToSdkCleartextRelayer(error)) {
        return super.publicDecrypt(encryptedValues as Hex[]);
      }

      throw error;
    }
  }
}

type HardhatMockUserDecryptResponse = {
  payload: {
    decrypted_values: string[];
  };
  signature: string;
};

type HardhatMockPublicDecryptResponse = {
  decrypted_value: string;
  signatures: string[];
};

async function hardhatJsonRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const transport = globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__;
  if (transport?.request) {
    const result = await transport.request({ method, params });
    return result as T;
  }

  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params,
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new DecryptionFailedError(`Hardhat FHEVM RPC ${method} failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: {
      message?: string;
    };
    result?: T;
  };

  if (payload.error) {
    throw new DecryptionFailedError(payload.error.message ?? `Hardhat FHEVM RPC ${method} failed`);
  }

  if (payload.result === undefined) {
    throw new DecryptionFailedError(`Hardhat FHEVM RPC ${method} returned an empty result`);
  }

  return payload.result;
}

function stripHexPrefix(value: Hex): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function normalizeHex(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

function resolveUserDecryptEncryptedValues(params: HardhatUserDecryptParams): string[] {
  const encryptedValues =
    'encryptedValues' in params && Array.isArray(params.encryptedValues) ? params.encryptedValues : undefined;
  if (encryptedValues && encryptedValues.length > 0) {
    return encryptedValues;
  }

  const handles = 'handles' in params && Array.isArray(params.handles) ? params.handles : undefined;
  if (handles && handles.length > 0) {
    return handles;
  }

  throw new DecryptionFailedError('Hardhat mock user decrypt received no encrypted handles');
}

function parseHardhatMockDecryptedScalar(handle: string, value: string): bigint {
  if (!value || value === '0x' || value === '0x0') {
    throw new DecryptionFailedError(
      `Hardhat mock relayer returned an empty cleartext value for handle ${handle}. ` +
        'The local FHEVM coprocessor no longer has plaintext for this encrypted balance handle while the ciphertext still exists on-chain. ' +
        'Restart the Hardhat node, redeploy contracts, fund the wallet again, and wait for auto-shield before decrypting.',
    );
  }

  if (/^\d+$/.test(value)) {
    return BigInt(value);
  }

  return BigInt(normalizeHex(value));
}

function shouldFallbackToSdkCleartextRelayer(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name}: ${error.message}`;
  return (
    message.includes('empty cleartext value') ||
    message.includes('Cannot convert 0x to a BigInt') ||
    message.includes('User input was not found in DB') ||
    message.includes('returned an empty result')
  );
}

function decodeHardhatMockCleartext(handle: string, rawValue: bigint): bigint | boolean | Address {
  const typeByte = Number((BigInt(handle) >> 8n) & 0xffn);

  if (typeByte === 0) {
    return rawValue !== 0n;
  }

  if (typeByte === 7) {
    return toHex(rawValue, { size: 20 });
  }

  return rawValue;
}

function buildHardhatMockDecryptionProof(signatures: readonly Hex[]): Hex {
  return concat([
    encodePacked(['uint8'], [signatures.length]),
    encodePacked([...signatures.map(() => 'bytes' as const)], [...signatures]),
    HARDHAT_PUBLIC_DECRYPT_EXTRA_DATA,
  ]);
}

function normalizeTransactionResult(result: TransactionResult | unknown): PaayeeConfidentialTransferResult {
  if (!result || typeof result !== 'object') {
    return {};
  }

  const candidate = result as {
    hash?: Hex;
    receipt?: TransactionReceipt;
    transactionHash?: Hex;
    txHash?: Hex;
    userOperationHash?: Hex;
  };

  return {
    receipt: candidate.receipt,
    transactionHash: candidate.txHash ?? candidate.transactionHash ?? candidate.hash,
    userOperationHash: candidate.userOperationHash,
  };
}

export async function protectPaayeeMetadataKey(input: {
  aclPolicy: PaayeeMetadataAclPolicy;
  keyBase64: string;
  operationId?: string;
}): Promise<PaayeeProtectedMetadataKey> {
  const transport = getSmartAccountTransport();

  if (!transport.protectMetadataKey) {
    throw new Error(
      'Paayee metadata key protection is not configured. Local, sandbox, and production builds must protect AES receipt keys through the Klyde smart-account/FHE ACL transport.',
    );
  }

  return transport.protectMetadataKey(input);
}

export async function unprotectPaayeeMetadataKey(input: {
  aclPolicy: PaayeeMetadataAclPolicy;
  keyHandle: string;
}): Promise<string> {
  const transport = getSmartAccountTransport();

  if (!transport.unprotectMetadataKey) {
    throw new Error(
      'Paayee metadata key decryption is not configured. The Klyde smart-account/FHE ACL transport must unprotect this receipt key.',
    );
  }

  const keyBase64 = await transport.unprotectMetadataKey(input);

  if (!keyBase64) {
    throw new Error('Encrypted receipt key is unavailable for this smart account.');
  }

  return keyBase64;
}

export async function getPaayeeZamaConfidentialBalance(input: {
  chainId: number;
  owner?: string;
  tokenAddress: string;
}): Promise<bigint> {
  const sdk = await getPaayeeZamaSdk(input.chainId);
  const account = await refreshPaayeeZamaWalletAccount(sdk);
  const owner = input.owner ?? account?.address ?? sdk.signer?.walletAccount.getSnapshot()?.address;

  if (!owner) {
    throw new Error('Paayee smart-account owner is required to decrypt a confidential balance.');
  }

  const token = createPaayeeConfidentialToken(sdk, input.tokenAddress as Address);

  if (!token.balanceOf) {
    throw new Error('Zama SDK token does not expose balanceOf in this mobile runtime.');
  }

  assertZamaDecryptionAvailable(sdk);
  return token.balanceOf(owner as Address);
}

export async function getPaayeeZamaConfidentialBalanceHandle(input: {
  chainId: number;
  owner?: string;
  tokenAddress: string;
}): Promise<string> {
  const sdk = await getPaayeeZamaSdk(input.chainId);
  const account = await refreshPaayeeZamaWalletAccount(sdk);
  const owner = input.owner ?? account?.address ?? sdk.signer?.walletAccount.getSnapshot()?.address;

  if (!owner) {
    throw new Error('Paayee smart-account owner is required to read a confidential balance handle.');
  }

  const token = createPaayeeConfidentialToken(sdk, input.tokenAddress as Address);

  if (!token.confidentialBalanceOf) {
    throw new Error('Zama SDK token does not expose confidentialBalanceOf in this mobile runtime.');
  }

  return token.confidentialBalanceOf(owner as Address);
}

function createPaayeeConfidentialToken(sdk: ZamaSDK, tokenAddress: Address): PaayeeConfidentialToken {
  const candidate = sdk as ZamaSDK & {
    createToken?: (address: Address) => PaayeeConfidentialToken;
    createWrappedToken?: (address: Address) => PaayeeConfidentialToken;
  };

  if (typeof candidate.createWrappedToken === 'function') {
    return candidate.createWrappedToken(tokenAddress);
  }

  if (typeof candidate.createToken === 'function') {
    return candidate.createToken(tokenAddress);
  }

  throw new Error('Zama SDK token factory is unavailable in this mobile runtime.');
}

function assertZamaDecryptionAvailable(sdk: ZamaSDK): void {
  if (typeof sdk.decryption?.decryptValues !== 'function' || typeof sdk.decryption?.decryptPublicValues !== 'function') {
    throw new Error('Zama SDK decryption helpers are unavailable in this mobile runtime.');
  }
}

async function refreshPaayeeZamaWalletAccount(sdk: ZamaSDK): Promise<WalletAccount | undefined> {
  const signer = sdk.signer;

  if (signer instanceof PaayeeKlydeSmartAccountSigner) {
    return signer.refreshWalletAccount();
  }

  return signer?.walletAccount.getSnapshot();
}

function getPaayeeZamaSdk(chainId: number): Promise<ZamaSDK> {
  if (!sdkCache || sdkCache.chainId !== chainId) {
    sdkCache = {
      chainId,
      sdk: Promise.resolve().then(() => createPaayeeZamaSdk(chainId)),
    };
  }

  return sdkCache.sdk;
}

function createPaayeeZamaSdk(chainId: number): ZamaSDK {
  const chain = viemChainById[chainId] ?? sepolia;
  const publicClient = createPublicClient({
    chain,
    transport: http(getRpcUrl(chain.id)),
  });
  const signer = new PaayeeKlydeSmartAccountSigner();
  const provider = new PaayeeKlydeSmartAccountProvider(publicClient, chain.id);
  const fheChain = createFheChainConfig(chain.id);

  return new ZamaSDK(createConfig({
    chains: [fheChain],
    provider,
    relayers: { [fheChain.id]: createRelayerConfig(fheChain) },
    signer,
    storage: memoryStorage,
  }));
}

function createHardhatFhevmCleartextRelayerConfig(): {
  type: 'cleartext';
  createRelayer: (chain: FheChain) => PaayeeHardhatFhevmCleartextRelayer;
} {
  return {
    type: 'cleartext',
    createRelayer: (chain) =>
      new PaayeeHardhatFhevmCleartextRelayer({
        ...chain,
        network: getRpcUrl(chain.id),
      }),
  };
}

class PaayeeKlydeSmartAccountSigner implements GenericSigner {
  readonly walletAccount: WalletAccountStore;
  private readonly mutableWalletAccount = createWalletAccountStore();

  constructor() {
    this.walletAccount = this.mutableWalletAccount;
  }

  requireWalletAccount(operation: string): WalletAccount {
    const account = this.walletAccount.getSnapshot();
    if (!account) {
      throw new WalletNotConnectedError(operation);
    }

    return account;
  }

  async refreshWalletAccount(): Promise<WalletAccount | undefined> {
    const transport = getSmartAccountTransport();
    const account = {
      address: await transport.getAddress(),
      chainId: await transport.getChainId(),
    };

    this.mutableWalletAccount.setSnapshot(account);
    return account;
  }

  async signTypedData(typedData: EIP712TypedData): Promise<Hex> {
    await this.refreshWalletAccount();
    return getSmartAccountTransport().signTypedData(typedData);
  }

  async writeContract<
    const TAbi extends ContractAbi,
    TFunctionName extends WriteFunctionName<TAbi>,
    const TArgs extends WriteContractArgs<TAbi, TFunctionName>,
  >(config: WriteContractConfig<TAbi, TFunctionName, TArgs>): Promise<Hex> {
    await this.refreshWalletAccount();
    return getSmartAccountTransport().writeContract(config);
  }
}

class PaayeeKlydeSmartAccountProvider implements GenericProvider {
  constructor(
    private readonly publicClient: ReturnType<typeof createPublicClient>,
    private readonly chainId: number,
  ) {}

  async getChainId(): Promise<number> {
    return this.chainId;
  }

  async readContract<
    const TAbi extends ContractAbi,
    TFunctionName extends ReadFunctionName<TAbi>,
    const TArgs extends ReadContractArgs<TAbi, TFunctionName>,
  >(config: ReadContractConfig<TAbi, TFunctionName, TArgs>): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs>> {
    const transport = globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__;
    if (transport?.readContract) {
      return transport.readContract(config);
    }

    return this.publicClient.readContract(config as Parameters<typeof this.publicClient.readContract>[0]) as Promise<
      ReadContractReturnType<TAbi, TFunctionName, TArgs>
    >;
  }

  async waitForTransactionReceipt(hash: Hex): Promise<TransactionReceipt> {
    const transport = globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__;
    if (transport?.waitForTransactionReceipt) {
      return transport.waitForTransactionReceipt(hash);
    }

    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      return {
        logs: receipt.logs.map((log) => ({
          data: log.data,
          topics: log.topics,
        })),
      };
    } catch (error) {
      throw new TransactionRevertedError(
        `Could not find transaction receipt for "${hash.slice(0, 10)}...". If this is an ERC-4337 smart account, return the final transaction hash from the Klyde smart-account transport.`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  async getBlockTimestamp(): Promise<bigint> {
    const block = await this.publicClient.getBlock();
    return block.timestamp;
  }
}

function getSmartAccountTransport(): PaayeeSmartAccountTransport {
  const transport = globalThis.__PAAYEE_KLYDE_SMART_ACCOUNT_TRANSPORT__;

  if (!transport) {
    throw new Error('Paayee smart-account signer is not configured yet.');
  }

  return transport;
}

function createFheChainConfig(chainId: number): FheChain {
  const base: FheChain =
    chainId === mainnet.id ? zamaMainnet : chainId === hardhat.id ? zamaHardhat : zamaSepolia;
  const executorAddress = chainId === hardhat.id ? getLocalExecutorAddress(base) : base.executorAddress;

  return {
    ...base,
    executorAddress,
    id: chainId,
    network: getRpcUrl(chainId),
    relayerUrl: getRelayerUrl(chainId),
  };
}

function getLocalExecutorAddress(base: FheChain): `0x${string}` | undefined {
  const configured = process.env.EXPO_PUBLIC_ZAMA_LOCAL_EXECUTOR_ADDRESS?.trim();

  if (!configured) {
    return base.executorAddress;
  }

  if (isAddress(configured)) {
    return configured as `0x${string}`;
  }

  if (__DEV__) {
    console.warn('[paayee.zama.runtime]', {
      event: 'invalid_local_executor_address',
      fallback: base.executorAddress,
      value: configured,
    });
  }

  return base.executorAddress;
}

function createRelayerConfig(chain: FheChain) {
  if (chain.id === hardhat.id) {
    if (!chain.executorAddress) {
      throw new Error('EXPO_PUBLIC_ZAMA_LOCAL_EXECUTOR_ADDRESS is required for local Hardhat cleartext FHEVM.');
    }

    return createHardhatFhevmCleartextRelayerConfig();
  }

  return web();
}

export function getPaayeeZamaRpcUrl(chainId: number): string {
  return getRpcUrl(chainId);
}

function getDevMachineHost(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.linkingUri;
  if (!hostUri) {
    return undefined;
  }

  try {
    return new URL(hostUri.startsWith('http') ? hostUri : `http://${hostUri}`).hostname;
  } catch {
    return undefined;
  }
}

function getRpcUrl(chainId: number): string {
  if (chainId === hardhat.id) {
    const explicit = process.env.EXPO_PUBLIC_ZAMA_LOCAL_RPC_URL;
    if (explicit) {
      return explicit;
    }

    const devHost = getDevMachineHost();
    if (devHost && devHost !== '127.0.0.1' && devHost !== 'localhost') {
      return `http://${devHost}:8545`;
    }

    return explicit ?? 'http://127.0.0.1:8545';
  }

  if (chainId === mainnet.id) {
    return process.env.EXPO_PUBLIC_ZAMA_MAINNET_RPC_URL ?? 'https://ethereum-rpc.publicnode.com';
  }

  return process.env.EXPO_PUBLIC_ZAMA_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
}

function getRelayerUrl(chainId: number): string {
  const explicit =
    chainId === mainnet.id
      ? process.env.EXPO_PUBLIC_ZAMA_MAINNET_RELAYER_URL
      : chainId === hardhat.id
        ? process.env.EXPO_PUBLIC_ZAMA_LOCAL_RELAYER_URL
        : process.env.EXPO_PUBLIC_ZAMA_SEPOLIA_RELAYER_URL;

  return explicit ?? `${getKlydeConfig().apiUrl}/v1/relayer/${chainId}`;
}

const klydeUnwrapRequestedEvent = parseAbiItem(
  'event UnwrapRequested(address indexed receiver, bytes32 amount)',
);

async function resolveTransactionReceipt(result: PaayeeConfidentialTransferResult): Promise<TransactionReceipt> {
  if (result.receipt) {
    return result.receipt;
  }

  if (!result.transactionHash) {
    throw new TransactionRevertedError('The unwrap transaction did not return a transaction hash.');
  }

  const transport = getSmartAccountTransport();
  if (!transport.waitForTransactionReceipt) {
    throw new TransactionRevertedError(
      'Paayee smart-account transport must expose waitForTransactionReceipt for Klyde-compatible unshield.',
    );
  }

  return transport.waitForTransactionReceipt(result.transactionHash);
}

function findKlydeUnwrapAmountHandle(receipt: TransactionReceipt): Hex {
  for (const log of receipt.logs ?? []) {
    try {
      const decoded = decodeEventLog({
        abi: [klydeUnwrapRequestedEvent],
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });

      if (decoded.eventName === 'UnwrapRequested') {
        const amount = decoded.args.amount;
        if (typeof amount === 'string') {
          return amount;
        }
      }
    } catch {
      // Ignore unrelated logs from ERC-20/FHEVM helper contracts in the same receipt.
    }
  }

  throw new TransactionRevertedError('No Klyde UnwrapRequested event found in unshield receipt.');
}
