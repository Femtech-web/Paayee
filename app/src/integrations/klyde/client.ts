import * as SecureStore from 'expo-secure-store';

import type {
  DepositSource,
  KlydeBalance,
  KlydeConversion,
  KlydeDeposit,
  KlydeFundingInstructions,
  KlydeQuote,
  KlydeRecentRecipient,
  KlydeReceipt,
  KlydeTimelineItem,
  KlydeTransaction,
  KlydeUser,
  KlydeWallet,
  KlydeWalletSnapshot,
  KlydeWithdrawal,
  MoneyAmount,
  SettlementAsset,
  WithdrawalDestination,
} from '@klyde/core';
import {
  type BootstrapHostAppSessionInput,
  createKlyde,
  type CreateDepositInput,
  type CreateKlydeOptions,
  type ExecuteConversionInput,
  type CreateWithdrawalInput,
  type GetConversionInput,
  type GetFundingInstructionsInput,
  type GetReceiptInput,
  type GetWalletSnapshotInput,
  type KlydeAuthRequestOptions,
  type KlydeAuthResult,
  type KlydeClient,
  type KlydePaginatedResponse,
  type KlydeRequestOptions,
  type KlydeSdkCommands,
  type ListReceiptsInput,
  type ListRecentRecipientsInput,
  type ListTransactionsInput,
  type QuoteConversionInput,
  type QuoteDepositInput,
  type QuoteWithdrawalInput,
  type SimulateFundingReceivedInput,
  type SimulateFundingReceivedResult,
  type StartEmailVerificationInput,
  type StartVerificationResult,
  type VerifyEmailInput,
} from '@klyde/sdk';

import { runtimeConfig } from '@/config/runtime';
import { requestKlydeHostAppAssertion } from '@/integrations/supabase';

import { getKlydeConfig } from './env';

const KLYDE_SESSION_TOKEN_KEY = 'paayee.klyde.sessionToken';
const KLYDE_REFRESH_TOKEN_KEY = 'paayee.klyde.refreshToken';

let hydratedClientPromise: Promise<KlydeClient> | undefined;

export type {
  BootstrapHostAppSessionInput,
  CreateDepositInput,
  CreateWithdrawalInput,
  DepositSource,
  GetReceiptInput,
  KlydeAuthResult,
  KlydeBalance,
  KlydeConversion,
  KlydeDeposit,
  KlydeFundingInstructions,
  KlydeQuote,
  KlydePaginatedResponse,
  KlydeRecentRecipient,
  KlydeReceipt,
  KlydeRequestOptions,
  KlydeTimelineItem,
  KlydeTransaction,
  KlydeUser,
  KlydeWallet,
  KlydeWalletSnapshot,
  KlydeWithdrawal,
  ExecuteConversionInput,
  GetConversionInput,
  GetFundingInstructionsInput,
  ListReceiptsInput,
  ListRecentRecipientsInput,
  ListTransactionsInput,
  MoneyAmount,
  QuoteConversionInput,
  QuoteDepositInput,
  QuoteWithdrawalInput,
  SimulateFundingReceivedInput,
  SimulateFundingReceivedResult,
  SettlementAsset,
  StartEmailVerificationInput,
  StartVerificationResult,
  VerifyEmailInput,
  WithdrawalDestination,
};

export type KlydeMoneyAmount = MoneyAmount;
export type PaayeeKlydeClient = KlydeClient;
export type PaayeeKlydeCommands = KlydeSdkCommands;

export async function getKlydeClient(): Promise<KlydeClient> {
  assertRealKlydeIntegrationsEnabled();

  hydratedClientPromise ??= createHydratedKlydeClient();

  return hydratedClientPromise;
}

export function createKlydeClient(options: Partial<CreateKlydeOptions> = {}): KlydeClient {
  const config = getKlydeConfig();

  return createKlyde({
    apiUrl: config.apiUrl,
    appId: config.appId,
    apiKey: config.apiKey,
    environment: config.environment,
    market: config.market,
    sessionStore: {
      getRefreshToken: () => getSecureStoreValue(KLYDE_REFRESH_TOKEN_KEY),
      getSessionToken: () => getSecureStoreValue(KLYDE_SESSION_TOKEN_KEY),
      setRefreshToken: (token) => setSecureStoreValue(KLYDE_REFRESH_TOKEN_KEY, token),
      setSessionToken: (token) => setSecureStoreValue(KLYDE_SESSION_TOKEN_KEY, token),
    },
    ...options,
  });
}

export async function startKlydeEmailVerification(
  input: StartEmailVerificationInput,
  options?: KlydeAuthRequestOptions,
): Promise<StartVerificationResult> {
  const client = await getKlydeClient();

  return client.auth.startEmailVerification(input, options);
}

export async function verifyKlydeEmail(
  input: VerifyEmailInput,
  options?: KlydeAuthRequestOptions,
): Promise<KlydeAuthResult> {
  const client = await getKlydeClient();
  const result = await client.auth.verifyEmail(input, options);

  await persistKlydeAuthResult(result);

  return result;
}

export async function refreshKlydeSession(
  options?: KlydeAuthRequestOptions,
): Promise<KlydeAuthResult | undefined> {
  const refreshToken = await SecureStore.getItemAsync(KLYDE_REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    return undefined;
  }

  const client = await getKlydeClient();
  const result = await client.auth.refreshSession({ refreshToken }, options);

  await persistKlydeAuthResult(result);

  return result;
}

export async function bootstrapKlydeHostAppSession(
  input: BootstrapHostAppSessionInput,
  options?: KlydeAuthRequestOptions,
): Promise<KlydeAuthResult> {
  const client = await getKlydeClient();

  return client.auth.bootstrapHostAppSession(input, options);
}

export async function clearKlydeSession(options?: KlydeAuthRequestOptions): Promise<void> {
  const client = hydratedClientPromise ? await hydratedClientPromise : undefined;

  if (client) {
    try {
      await client.auth.logout(options);
    } catch {
      await client.setSessionToken(undefined);
    }
  }

  await Promise.all([
    SecureStore.deleteItemAsync(KLYDE_SESSION_TOKEN_KEY),
    SecureStore.deleteItemAsync(KLYDE_REFRESH_TOKEN_KEY),
  ]);

  hydratedClientPromise = undefined;
}

export async function getKlydeUser(options?: KlydeRequestOptions): Promise<KlydeUser> {
  return withKlydeClient((client) => client.getUser(options));
}

export async function getKlydeWallet(options?: KlydeRequestOptions): Promise<KlydeWallet> {
  return withKlydeClient((client) => client.getWallet(options));
}

export async function getKlydeWalletSnapshot(
  input?: GetWalletSnapshotInput,
  options?: KlydeRequestOptions,
): Promise<KlydeWalletSnapshot> {
  return withKlydeClient((client) => client.getWalletSnapshot(input, options));
}

export async function getKlydeBalances(
  input?: GetWalletSnapshotInput,
  options?: KlydeRequestOptions,
): Promise<KlydeBalance[]> {
  return withKlydeClient((client) => client.getBalances(input, options));
}

export async function getKlydeAccountSnapshot(options?: KlydeRequestOptions): Promise<{
  user: KlydeUser;
  wallet: KlydeWallet;
}> {
  return withKlydeClient(async (client) => {
    const [user, wallet] = await Promise.all([client.getUser(options), client.getWallet(options)]);

    return { user, wallet };
  });
}

export async function quoteKlydeDeposit(
  input: QuoteDepositInput,
  options?: KlydeRequestOptions,
) {
  return withKlydeClient((client) => client.quoteDeposit(input, options));
}

export async function createKlydeDeposit(
  input: CreateDepositInput,
  options?: KlydeRequestOptions,
): Promise<KlydeDeposit> {
  return withKlydeClient((client) => client.deposit(input, options));
}

export async function quoteKlydeWithdrawal(
  input: QuoteWithdrawalInput,
  options?: KlydeRequestOptions,
) {
  return withKlydeClient((client) => client.quoteWithdrawal(input, options));
}

export async function createKlydeWithdrawal(
  input: CreateWithdrawalInput,
  options?: KlydeRequestOptions,
): Promise<KlydeWithdrawal> {
  return withKlydeClient((client) => client.withdraw(input, options));
}

export async function quoteKlydeConversion(
  input: QuoteConversionInput,
  options?: KlydeRequestOptions,
) {
  return withKlydeClient((client) => client.quoteConversion(input, options));
}

export async function executeKlydeConversion(
  input: ExecuteConversionInput,
  options?: KlydeRequestOptions,
): Promise<KlydeConversion> {
  return withKlydeClient((client) => client.executeConversion(input, options));
}

export async function getKlydeConversion(
  input: GetConversionInput,
  options?: KlydeRequestOptions,
): Promise<KlydeConversion> {
  return withKlydeClient((client) => client.getConversion(input, options));
}

export async function getKlydeFundingInstructions(
  input?: GetFundingInstructionsInput,
  options?: KlydeRequestOptions,
): Promise<KlydeFundingInstructions> {
  return withKlydeClient((client) => client.getFundingInstructions(input, options));
}

export async function simulateKlydeFundingReceived(
  input: SimulateFundingReceivedInput,
  options?: KlydeRequestOptions,
): Promise<SimulateFundingReceivedResult> {
  return withKlydeClient((client) => {
    const simulateFundingReceived = client.simulateFundingReceived?.bind(client);

    if (simulateFundingReceived) {
      return simulateFundingReceived(input, options);
    }

    const request = (client as unknown as {
      request?: (
        method: 'POST',
        path: string,
        body: SimulateFundingReceivedInput,
        options?: KlydeRequestOptions,
      ) => Promise<SimulateFundingReceivedResult>;
    }).request?.bind(client);

    if (!request) {
      throw new Error('This Klyde SDK build does not support funding simulation.');
    }

    return request('POST', '/v1/funding/simulate-received', input, options);
  });
}

export async function getKlydeReceipt(
  input: GetReceiptInput,
  options?: KlydeRequestOptions,
): Promise<KlydeReceipt> {
  return withKlydeClient((client) => client.getReceipt(input, options));
}

export async function listKlydeReceipts(
  input?: ListReceiptsInput,
  options?: KlydeRequestOptions,
): Promise<KlydePaginatedResponse<KlydeReceipt>> {
  return withKlydeClient((client) => client.listReceipts(input, options));
}

export async function listKlydeTransactions(
  input?: ListTransactionsInput,
  options?: KlydeRequestOptions,
): Promise<KlydePaginatedResponse<KlydeTransaction>> {
  return withKlydeClient((client) => client.listTransactions(input, options));
}

export async function listKlydeRecentRecipients(
  input?: ListRecentRecipientsInput,
  options?: KlydeRequestOptions,
): Promise<KlydeRecentRecipient[]> {
  return withKlydeClient((client) => client.listRecentRecipients(input, options));
}

async function createHydratedKlydeClient(): Promise<KlydeClient> {
  return createKlydeClient();
}

async function persistKlydeAuthResult(result: KlydeAuthResult): Promise<void> {
  await SecureStore.setItemAsync(KLYDE_SESSION_TOKEN_KEY, result.session.id);

  if (result.refreshToken) {
    await SecureStore.setItemAsync(KLYDE_REFRESH_TOKEN_KEY, result.refreshToken);
  }
}

async function withKlydeClient<T>(operation: (client: KlydeClient) => Promise<T>): Promise<T> {
  const client = await getKlydeClient();

  try {
    return await operation(client);
  } catch (error) {
    if (!isRecoverableKlydeSessionError(error)) {
      throw error;
    }

    try {
      const assertion = await requestKlydeHostAppAssertion();
      await client.auth.bootstrapHostAppSession({
        assertion,
        deviceName: 'Paayee mobile',
      });
    } catch (restoreError) {
      throw new Error(`Could not restore Klyde session: ${readErrorMessage(restoreError)}`);
    }

    try {
      return await operation(client);
    } catch (retryError) {
      throw new Error(`Klyde session was restored, but the request still failed: ${readErrorMessage(retryError)}`);
    }
  }
}

function assertRealKlydeIntegrationsEnabled(): void {
  if (!runtimeConfig.realIntegrationsEnabled) {
    throw new Error('Klyde integrations are disabled for this build.');
  }
}

function setSecureStoreValue(key: string, value: string | undefined): Promise<void> {
  if (!value) {
    return SecureStore.deleteItemAsync(key);
  }

  return SecureStore.setItemAsync(key, value);
}

async function getSecureStoreValue(key: string): Promise<string | undefined> {
  return (await SecureStore.getItemAsync(key)) ?? undefined;
}

function isRecoverableKlydeSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  return (
    code === 'KYLDE_SESSION_MISSING' ||
    code === 'KYLDE_REFRESH_TOKEN_EXPIRED' ||
    code === 'KYLDE_REFRESH_TOKEN_REVOKED'
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
