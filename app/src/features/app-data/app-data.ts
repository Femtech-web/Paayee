import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { runtimeConfig } from '@/config/runtime';
import {
  getKlydeWalletSnapshot,
  listKlydeConfidentialOperations,
  listKlydeConversions,
  listKlydeRecentRecipients,
  listKlydeTransactions,
  type KlydeBalance,
  type KlydeConversion,
  type KlydeConfidentialOperation,
  type KlydeRates,
  type KlydeRecentRecipient,
  type KlydeTransaction,
  type KlydeWallet,
  type KlydeWalletSnapshot,
  type MoneyAmount,
} from '@/integrations/klyde/client';
import {
  clearPaayeeConfidentialBalanceCache,
  getPaayeeConfidentialBalanceDisplay,
  revealPaayeeConfidentialBalances,
  listPaayeePrivateOperationEnvelopes,
  isStablecoinAsset,
  type PaayeePrivateOperationEnvelope,
} from '@/features/confidential/confidential-money';
import { getPaayeePublicTokenBalance } from '@/features/confidential/zama-mobile-runtime';
import {
  getCurrentProfile,
  listCurrentBeneficiaries,
  type PaayeeBeneficiary,
  type PaayeeProfile,
} from '@/integrations/supabase';
import {
  getPaayeeChainActivity,
  getPaayeeRates,
  type PaayeeDeposit,
  type PaayeeOperation,
  type PaayeePrivateTransfer,
  type PaayeeReceipt,
} from '@/integrations/paayee';
import { getDisplayCurrencyPreference, type DisplayCurrency } from '@/features/preferences/display-currency-preference';

export type AppProfile = {
  email: string;
  countryOfResidence?: string;
  dateOfBirth?: string;
  firstName: string;
  handle?: string;
  initials: string;
  lastName: string;
  name: string;
  phoneNumber?: string;
  residentialAddress?: string;
  smartAccountAddress?: string;
};

export type AppBalance = {
  code: 'NGN' | 'USDC' | 'USDT';
  confidentialBalanceHandle?: string;
  confidentialityStatus?: 'available' | 'handle_available' | 'unavailable';
  displayAmount: string;
  icon: 'ngn' | 'usdc' | 'usdt';
  label: string;
  name: string;
  numericAmount: number;
  privateNumericAmount?: number;
  publicNumericAmount?: number;
};

export type AppRecipient = {
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  handle?: string;
  id: string;
  initials: string;
  lastUsed: string;
  name: string;
  networkName?: string;
  note: string;
  rails: string[];
  walletAddress?: string;
};

export type AppTransaction = {
  amount: string;
  createdAt: string;
  detail: string;
  icon?: 'arrow-down-left' | 'eye' | 'repeat' | 'shield' | 'trending-up';
  id: string;
  initials?: string;
  kind: KlydeTransaction['kind'] | 'conversion' | 'private-send' | 'private-conversion' | 'private-receive' | 'shield' | 'unshield' | 'send';
  privateEnvelopeId?: string;
  receiptId?: string;
  secondaryAmount?: string;
  title: string;
  tone?: 'negative' | 'positive' | 'receipt';
  when: string;
};

export type AppData = {
  balances: AppBalance[];
  displayCurrency: DisplayCurrency;
  profile: AppProfile;
  recipients: AppRecipient[];
  totalDisplay: string;
  transactions: AppTransaction[];
  wallet?: KlydeWallet;
};

export type AppDataState = {
  data?: AppData;
  error?: string;
  loading: boolean;
  refresh: (options?: {
    revealPrivateAssetCodes?: ('USDC' | 'USDT')[];
    revealPrivateBalances?: boolean;
    silent?: boolean;
  }) => Promise<void>;
};

const emptyProfile: AppProfile = {
  email: '',
  firstName: '',
  initials: 'PY',
  lastName: '',
  name: 'Paayee user',
};

const emptyBalances: AppBalance[] = [
  {
    code: 'NGN',
    displayAmount: '₦0.00',
    icon: 'ngn',
    label: 'Local transfer balance',
    name: 'Nigerian Naira',
    numericAmount: 0,
    privateNumericAmount: 0,
    publicNumericAmount: 0,
  },
  {
    code: 'USDC',
    displayAmount: '$0.00',
    icon: 'usdc',
    label: 'Private dollar balance',
    name: 'USD Coin',
    numericAmount: 0,
    privateNumericAmount: 0,
    publicNumericAmount: 0,
  },
  {
    code: 'USDT',
    displayAmount: '$0.00',
    icon: 'usdt',
    label: 'Private tether balance',
    name: 'Tether USD',
    numericAmount: 0,
    privateNumericAmount: 0,
    publicNumericAmount: 0,
  },
];

const supportedBalanceCodes = ['NGN', 'USDC', 'USDT'] as const;
type SupportedBalanceCode = (typeof supportedBalanceCodes)[number];
const privateTransferFingerprintByWallet = new Map<string, string>();

export function useAppData(): AppDataState {
  const [data, setData] = useState<AppData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const hasLoadedInitialData = useRef(false);
  const refreshInFlight = useRef<Promise<void> | undefined>(undefined);

  const refresh = useCallback(async (options: {
    revealPrivateAssetCodes?: ('USDC' | 'USDT')[];
    revealPrivateBalances?: boolean;
    silent?: boolean;
  } = {}) => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const refreshPromise = Promise.resolve().then(async () => {
      if (!options.silent) {
        setLoading(true);
      }
      setError(undefined);

      try {
        setData(await loadAppData({
          revealPrivateAssetCodes: options.revealPrivateAssetCodes,
          revealPrivateBalances: options.revealPrivateBalances,
        }));
      } catch (fetchError) {
        setData(createEmptyAppData());
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load account data.');
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
        refreshInFlight.current = undefined;
      }
    });

    refreshInFlight.current = refreshPromise;
    return refreshPromise;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const nextData = await loadAppData();

        if (!cancelled) {
          setData(nextData);
          hasLoadedInitialData.current = true;
        }
      } catch (fetchError) {
        if (!cancelled) {
          setData(createEmptyAppData());
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load account data.');
          hasLoadedInitialData.current = true;
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedInitialData.current) {
        return;
      }

      void refresh({ silent: true });
    }, [refresh]),
  );

  useEffect(() => {
    if (!runtimeConfig.paayeeApiUrl && !runtimeConfig.zamaMobileRuntimeEnabled) {
      return;
    }

    const interval = setInterval(() => {
      if (hasLoadedInitialData.current) {
        void refresh({ silent: true });
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [refresh]);

  return useMemo(
    () => ({
      data,
      error,
      loading,
      refresh,
    }),
    [data, error, loading, refresh],
  );
}

async function loadAppData(options: {
  revealPrivateAssetCodes?: ('USDC' | 'USDT')[];
  revealPrivateBalances?: boolean;
} = {}): Promise<AppData> {
  const displayCurrency = await getDisplayCurrencyPreference();
  const legacyMoneyRailEnabled = runtimeConfig.legacyMoneyRailEnabled;
  const [
    profile,
    beneficiaries,
    klydeSnapshot,
    klydeTransactions,
    klydeConversions,
    recentRecipients,
    privateOperations,
    confidentialOperations,
    rates,
    chainActivity,
  ] = await Promise.all([
    getCurrentProfile(),
    listCurrentBeneficiaries(),
    legacyMoneyRailEnabled
      ? getKlydeWalletSnapshot({ baseCurrency: displayCurrency }).catch(() => undefined)
      : undefined,
    legacyMoneyRailEnabled
      ? listKlydeTransactions({ page: 1, pageSize: 10 }).catch(() => undefined)
      : undefined,
    legacyMoneyRailEnabled
      ? listKlydeConversions({ page: 1, pageSize: 10 }).catch(() => undefined)
      : undefined,
    legacyMoneyRailEnabled ? listKlydeRecentRecipients({ limit: 10 }).catch(() => []) : [],
    listPaayeePrivateOperationEnvelopes({ hydrate: false }).catch(() => []),
    legacyMoneyRailEnabled
      ? listKlydeConfidentialOperations({ page: 1, pageSize: 50 }).catch(() => [])
      : [],
    getPaayeeRates('NGN').catch(() => undefined),
    getPaayeeChainActivity().catch(() => ({ deposits: [], operations: [], privateTransfers: [], receipts: [] })),
  ]);
  const wallet = klydeSnapshot?.wallet ?? createProfileWallet(profile);
  synchronizePrivateTransferBalanceCache(wallet?.address, chainActivity.privateTransfers ?? []);
  const ownedPrivateOperations = wallet?.address
    ? privateOperations.filter((envelope) => {
        const ownerAddress = envelope.ownerAddress ?? envelope.fromAddress;
        return ownerAddress?.toLowerCase() === wallet.address.toLowerCase();
      })
    : [];
  if (options.revealPrivateBalances) {
    await revealPaayeeConfidentialBalances({
      assetCodes: options.revealPrivateAssetCodes ?? ['USDC', 'USDT'],
      chainId: runtimeConfig.zamaChainId,
      owner: wallet?.address,
    }).catch((revealError) => {
      if (__DEV__) console.warn('[paayee.confidential.balance]', {
        event: 'zama_batch_balance_failed',
        message: revealError instanceof Error ? revealError.message : String(revealError),
      });
    });
  }
  const privateBalances = await applyConfidentialBalanceDisplays(
    normalizeBalances(klydeSnapshot?.balances),
    wallet,
    confidentialOperations,
  );
  const balances = await applyPublicStablecoinBalances(privateBalances, wallet);
  const receiptByDepositId = new Map(
    (chainActivity.receipts ?? [])
      .filter((receipt) => receipt.deposit_id)
      .map((receipt) => [receipt.deposit_id as string, receipt]),
  );
  const receiptByOperationId = new Map(
    (chainActivity.receipts ?? [])
      .filter((receipt) => receipt.operation_id)
      .map((receipt) => [receipt.operation_id as string, receipt]),
  );
  const receiptByPrivateTransferId = new Map(
    (chainActivity.receipts ?? [])
      .filter((receipt) => receipt.private_transfer_id)
      .map((receipt) => [receipt.private_transfer_id as string, receipt]),
  );
  const transactions = [
    ...(klydeTransactions?.data.map(normalizeTransaction) ?? []),
    ...(klydeConversions?.data.map(normalizeConversion) ?? []),
    ...ownedPrivateOperations.map(normalizePrivateOperation),
    ...chainActivity.deposits.map((deposit) => normalizePaayeeDeposit(deposit, receiptByDepositId.get(deposit.id))),
    ...chainActivity.operations
      .filter((operation) => !ownedPrivateOperations.some((envelope) =>
        Boolean(envelope.transactionHash) && envelope.transactionHash?.toLowerCase() === operation.transaction_hash.toLowerCase()))
      .map((operation) => normalizePaayeeOperation(operation, receiptByOperationId.get(operation.id))),
    ...(chainActivity.privateTransfers ?? []).map((transfer) =>
      normalizePaayeePrivateTransfer(transfer, receiptByPrivateTransferId.get(transfer.id))),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 20);
  const recipients = [
    ...beneficiaries.map(normalizeBeneficiary),
    ...recentRecipients.map(normalizeRecentRecipient),
  ];

  return {
    balances,
    displayCurrency,
    profile: normalizeProfile(profile, wallet),
    recipients,
    totalDisplay: createTotalDisplay(balances, displayCurrency, klydeSnapshot?.valuation, rates),
    transactions,
    wallet,
  };
}

function synchronizePrivateTransferBalanceCache(
  walletAddress: string | undefined,
  transfers: PaayeePrivateTransfer[],
) {
  if (!walletAddress) return;
  const walletKey = walletAddress.toLowerCase();
  const fingerprint = transfers
    .slice(0, 10)
    .map((transfer) => `${transfer.id}:${transfer.status}`)
    .join('|');
  const previous = privateTransferFingerprintByWallet.get(walletKey);
  privateTransferFingerprintByWallet.set(walletKey, fingerprint);
  if (previous === undefined || previous === fingerprint) return;
  for (const assetCode of new Set(transfers.map((transfer) => transfer.token_symbol))) {
    clearPaayeeConfidentialBalanceCache({
      assetCode,
      chainId: runtimeConfig.zamaChainId,
      owner: walletAddress,
    });
  }
}

function normalizePaayeePrivateTransfer(
  transfer: PaayeePrivateTransfer,
  receipt?: PaayeeReceipt,
): AppTransaction {
  return {
    amount: 'Private amount',
    createdAt: transfer.created_at,
    detail: transfer.status === 'confirmed'
      ? `Confirmed · ${transfer.sender_handle ? `From ${transfer.sender_handle}` : 'Private balance updated'}`
      : `${transfer.confirmations} confirmation${transfer.confirmations === 1 ? '' : 's'}`,
    icon: 'shield',
    id: `private-transfer:${transfer.id}`,
    kind: 'private-receive',
    receiptId: receipt?.id,
    title: transfer.sender_handle
      ? `Private ${transfer.token_symbol} from ${transfer.sender_handle}`
      : `Private ${transfer.token_symbol} received`,
    tone: 'positive',
    when: formatTransactionDate(transfer.created_at),
  };
}

function normalizePaayeeDeposit(deposit: PaayeeDeposit, receipt?: PaayeeReceipt): AppTransaction {
  return {
    amount: `+${formatStablecoinMinorUnits(deposit.amount_minor_units, deposit.token_symbol)}`,
    createdAt: deposit.created_at,
    detail: deposit.status === 'confirmed'
      ? 'Confirmed · Ready to make private'
      : `${deposit.confirmations} confirmation${deposit.confirmations === 1 ? '' : 's'}`,
    icon: 'arrow-down-left',
    id: `deposit:${deposit.id}`,
    kind: 'deposit',
    receiptId: receipt?.id,
    title: `${deposit.token_symbol} received`,
    tone: 'positive',
    when: formatTransactionDate(deposit.created_at),
  };
}

function normalizePaayeeOperation(operation: PaayeeOperation, receipt?: PaayeeReceipt): AppTransaction {
  const isShield = operation.kind === 'shield';
  const isSend = operation.kind === 'public_send';
  return {
    amount: `${isSend ? '-' : ''}${formatStablecoinMinorUnits(operation.amount_minor_units, operation.token_symbol)}`,
    createdAt: operation.created_at,
    detail: `${titleCase(operation.status)} · ${isSend ? 'Spendable transfer' : isShield ? 'Public to private' : 'Private to public'}`,
    icon: isSend ? 'trending-up' : 'shield',
    id: `operation:${operation.id}`,
    kind: isSend ? 'send' : isShield ? 'shield' : 'unshield',
    receiptId: receipt?.id,
    title: isSend ? `${operation.token_symbol} sent` : isShield ? `${operation.token_symbol} made private` : `${operation.token_symbol} moved to public`,
    tone: 'receipt',
    when: formatTransactionDate(operation.created_at),
  };
}

function formatStablecoinMinorUnits(value: string, symbol: string): string {
  const amount = Number(value) / 1_000_000;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 2 })} ${symbol}`;
}

function createProfileWallet(profile?: PaayeeProfile): KlydeWallet | undefined {
  if (!profile?.smartAccountAddress) {
    return undefined;
  }

  return {
    address: profile.smartAccountAddress,
    appId: 'paayee',
    chainId: runtimeConfig.zamaChainId,
    createdAt: new Date(0).toISOString(),
    id: profile.privyUserId ?? profile.smartAccountAddress,
    kind: 'embedded',
    userId: profile.privyUserId ?? profile.id,
  };
}

function createEmptyAppData(): AppData {
  return {
    balances: emptyBalances,
    displayCurrency: 'NGN',
    profile: emptyProfile,
    recipients: [],
    totalDisplay: '₦0.00',
    transactions: [],
  };
}

function normalizeProfile(profile?: PaayeeProfile, wallet?: KlydeWallet): AppProfile {
  const firstName = cleanNamePart(profile?.firstName);
  const lastName = cleanNamePart(profile?.lastName);
  const fullName = [firstName, cleanNamePart(profile?.middleName), lastName].filter(Boolean).join(' ');
  const email = profile?.email?.trim() ?? '';
  const smartAccountAddress = profile?.smartAccountAddress ?? wallet?.address;

  return {
    email,
    countryOfResidence: profile?.countryOfResidence,
    dateOfBirth: profile?.dateOfBirth,
    firstName,
    handle: profile?.handle ? `@${profile.handle.replace(/^@+/, '')}` : undefined,
    initials: getInitials(firstName, lastName || email),
    lastName,
    name: fullName || email || 'Paayee user',
    phoneNumber: profile?.phoneNumber,
    residentialAddress: profile?.residentialAddress,
    smartAccountAddress,
  };
}

function normalizeBeneficiary(beneficiary: PaayeeBeneficiary): AppRecipient {
  const rails = [
    beneficiary.preferredAsset,
    beneficiary.bankName || beneficiary.accountNumber ? 'NGN' : undefined,
    beneficiary.handle ? 'Handle' : undefined,
  ].filter((rail, index, allRails): rail is string => Boolean(rail) && allRails.indexOf(rail) === index);

  return {
    accountNumber: beneficiary.accountNumber ?? undefined,
    bankName: beneficiary.bankName ?? undefined,
    handle: beneficiary.handle ?? undefined,
    id: beneficiary.id,
    initials: getInitials(beneficiary.displayName),
    lastUsed: 'Saved recipient',
    name: beneficiary.displayName,
    networkName: beneficiary.networkName,
    note: createRecipientNote(beneficiary),
    rails: rails.length ? rails : ['Paayee'],
    walletAddress: beneficiary.walletAddress ?? undefined,
  };
}

function normalizeRecentRecipient(recipient: KlydeRecentRecipient): AppRecipient {
  const bankName =
    recipient.destination.type === 'bank_account' ? recipient.destination.bankName : undefined;
  const bankAccount =
    recipient.destination.type === 'bank_account'
      ? parseBankAccountReference(recipient.destination.accountReference)
      : undefined;
  const walletAddress =
    recipient.destination.type === 'wallet' ? recipient.destination.address : undefined;

  return {
    accountNumber: bankAccount?.accountNumber,
    bankCode: bankAccount?.bankCode,
    bankName,
    id: `klyde:${recipient.id}`,
    initials: getInitials(recipient.label),
    lastUsed: formatTransactionDate(recipient.lastUsedAt),
    name: recipient.label,
    note: createRecentRecipientNote(recipient),
    rails: ['Recent'],
    walletAddress,
  };
}

function normalizeBalances(klydeBalances?: KlydeBalance[]): AppBalance[] {
  if (!klydeBalances?.length) {
    return emptyBalances;
  }

  const byCode = new Map(
    klydeBalances
      .map((balance) => [balance.currency.toUpperCase(), balance] as const)
      .filter(([code]) => isSupportedBalanceCode(code)),
  );

  return emptyBalances.map((emptyBalance) => {
    const balance = byCode.get(emptyBalance.code);

    if (!balance) {
      return emptyBalance;
    }

    if (isStablecoinAsset(emptyBalance.code)) {
      return emptyBalance;
    }

    return {
      ...emptyBalance,
      displayAmount: formatMoneyAmount(balance.total),
      numericAmount: parseMoneyAmount(balance.total),
      privateNumericAmount: parseMoneyAmount(balance.total),
    };
  });
}

async function applyConfidentialBalanceDisplays(
  balances: AppBalance[],
  wallet?: KlydeWallet,
  confidentialOperations: KlydeConfidentialOperation[] = [],
): Promise<AppBalance[]> {
  const owner = wallet?.address;
  const chainId = runtimeConfig.zamaChainId;
  const confidentialBalances = await Promise.all(
    balances.map(async (balance) => {
      if (!isStablecoinAsset(balance.code)) {
        return balance;
      }

      const privateBalance = await getPaayeeConfidentialBalanceDisplay({
        assetCode: balance.code,
        chainId,
        confidentialOperations,
        decrypt: false,
        hasOperationHistory: hasConfidentialOperationHistory(confidentialOperations, balance.code),
        owner,
      });

      if (privateBalance.status === 'available' && privateBalance.displayAmount) {
        return {
          ...balance,
          confidentialBalanceHandle: privateBalance.encryptedHandle,
          confidentialityStatus: privateBalance.status,
          displayAmount: privateBalance.displayAmount,
          numericAmount: parsePrivateStablecoinDisplay(privateBalance.displayAmount, balance.numericAmount),
          privateNumericAmount: parsePrivateStablecoinDisplay(privateBalance.displayAmount, balance.numericAmount),
        };
      }

      if (privateBalance.status === 'handle_available') {
        return {
          ...balance,
          confidentialBalanceHandle: privateBalance.encryptedHandle,
          confidentialityStatus: privateBalance.status,
          displayAmount: '$••••',
          numericAmount: 0,
          privateNumericAmount: 0,
        };
      }

      return {
        ...balance,
        confidentialityStatus: privateBalance.status,
        displayAmount: privateBalance.displayAmount ?? '$••••',
        numericAmount: 0,
        privateNumericAmount: 0,
      };
    }),
  );

  return confidentialBalances;
}

async function applyPublicStablecoinBalances(
  balances: AppBalance[],
  wallet?: KlydeWallet,
): Promise<AppBalance[]> {
  if (!wallet?.address) return balances;
  return Promise.all(balances.map(async (balance) => {
    if (!isStablecoinAsset(balance.code)) return balance;
    const tokenAddress = balance.code === 'USDC'
      ? '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      : '0x93C5d30a7509E60871B77A3548a5BD913334cd35';
    try {
      const value = await getPaayeePublicTokenBalance({
        chainId: runtimeConfig.zamaChainId,
        owner: wallet.address,
        tokenAddress,
      });
      return { ...balance, publicNumericAmount: Number(value) / 1_000_000 };
    } catch {
      return balance;
    }
  }));
}

function hasConfidentialOperationHistory(
  operations: KlydeConfidentialOperation[],
  assetCode: Extract<SupportedBalanceCode, 'USDC' | 'USDT'>,
): boolean {
  return operations.some((operation) => {
    const symbol = operation.symbol.trim().toUpperCase();
    const underlyingSymbol =
      typeof operation.metadata?.underlyingSymbol === 'string'
        ? operation.metadata.underlyingSymbol.trim().toUpperCase()
        : undefined;
    const targetUnderlyingSymbol =
      typeof operation.metadata?.targetUnderlyingSymbol === 'string'
        ? operation.metadata.targetUnderlyingSymbol.trim().toUpperCase()
        : undefined;
    const sourceCurrency =
      typeof operation.metadata?.sourceCurrency === 'string'
        ? operation.metadata.sourceCurrency.trim().toUpperCase()
        : undefined;

    return (
      (operation.mode === 'app_managed' || operation.mode === 'klyde_managed') &&
      operation.status !== 'failed' &&
      (symbol === `C${assetCode}` ||
        underlyingSymbol === assetCode ||
        targetUnderlyingSymbol === assetCode ||
        sourceCurrency === assetCode)
    );
  });
}

function normalizeTransaction(transaction: KlydeTransaction): AppTransaction {
  const isIncoming = transaction.kind === 'deposit';
  const assetCode = resolveTransactionAssetCode(transaction);
  const amount = formatMoneyAmountWithAsset(transaction.amount, { assetCode });
  const settlementAmount = transaction.settlementAmount
    ? formatMoneyAmountWithAsset(transaction.settlementAmount, {
        assetCode: transaction.settlementAsset?.symbol ?? transaction.settlementAmount.currency,
      })
    : undefined;

  return {
    amount: `${isIncoming ? '+' : '-'}${amount}`,
    createdAt: transaction.createdAt,
    detail: createTransactionDetail(transaction),
    icon: isIncoming ? 'arrow-down-left' : 'trending-up',
    id: transaction.id,
    initials: isStablecoinAssetCode(assetCode) ? getAssetBadgeText(assetCode) : undefined,
    kind: transaction.kind,
    receiptId: transaction.receiptId,
    secondaryAmount: settlementAmount,
    title: createTransactionTitle(transaction),
    tone: isIncoming ? 'positive' : 'negative',
    when: formatTransactionDate(transaction.createdAt),
  };
}

function normalizeConversion(conversion: KlydeConversion): AppTransaction {
  const isPrivateStablecoinConversion =
    isStablecoinAssetCode(conversion.sourceAmount.currency) ||
    isStablecoinAssetCode(conversion.targetAmount.currency);

  if (isPrivateStablecoinConversion) {
    return {
      amount: 'Private amount',
      createdAt: conversion.createdAt,
      detail: `${titleCase(conversion.status.replace(/_/g, ' '))} · Decrypt receipt to view amount`,
      icon: 'repeat',
      id: conversion.id,
      kind: 'conversion',
      title: 'Private conversion',
      tone: 'receipt',
      when: formatTransactionDate(conversion.createdAt),
    };
  }

  return {
    amount: `+${formatMoneyAmount(conversion.targetAmount)}`,
    createdAt: conversion.createdAt,
    detail: createConversionDetail(conversion),
    icon: 'repeat',
    id: conversion.id,
    kind: 'conversion',
    secondaryAmount: `-${formatMoneyAmount(conversion.sourceAmount)}`,
    title: 'Currency conversion',
    tone: 'positive',
    when: formatTransactionDate(conversion.createdAt),
  };
}

function normalizePrivateOperation(envelope: PaayeePrivateOperationEnvelope): AppTransaction {
  const isConversion = envelope.operationType === 'conversion';
  const status = titleCase(envelope.status.replace(/_/g, ' '));

  return {
    amount: 'Private amount',
    createdAt: envelope.createdAt,
    detail: `${status} · Decrypt receipt to view amount`,
    icon: isConversion ? 'repeat' : 'shield',
    id: envelope.operationId,
    kind: isConversion ? 'private-conversion' : 'private-send',
    privateEnvelopeId: envelope.id,
    title: isConversion ? 'Private conversion' : 'Private transfer',
    tone: 'receipt',
    when: formatTransactionDate(envelope.createdAt),
  };
}

function createTransactionTitle(transaction: KlydeTransaction): string {
  const assetCode = resolveTransactionAssetCode(transaction);

  if (transaction.kind === 'deposit') {
    return isStablecoinAssetCode(assetCode) ? `Public ${assetCode} deposit` : `${assetCode} deposit`;
  }

  if (transaction.kind === 'withdrawal') {
    return `${assetCode} withdrawal`;
  }

  if (transaction.kind === 'swap') {
    return 'Currency conversion';
  }

  if (transaction.kind === 'transfer') {
    return 'Transfer';
  }

  return 'Balance activity';
}

function createTransactionDetail(transaction: KlydeTransaction): string {
  const status = titleCase(transaction.status.replace(/_/g, ' '));
  const reference = transaction.reference ? ` · ${truncateMiddle(transaction.reference, 32)}` : '';
  const assetCode = resolveTransactionAssetCode(transaction);

  if (transaction.kind === 'deposit' && isStablecoinAssetCode(assetCode)) {
    return `${status} public ingress${reference}`;
  }

  return `${status}${reference}`;
}

function createConversionDetail(conversion: KlydeConversion): string {
  const status = titleCase(conversion.status.replace(/_/g, ' '));

  return `${status} · ${conversion.sourceAmount.currency} to ${conversion.targetAmount.currency}`;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const edgeLength = Math.max(Math.floor((maxLength - 3) / 2), 4);

  return `${value.slice(0, edgeLength)}...${value.slice(-edgeLength)}`;
}

function createTotalDisplay(
  balances: AppBalance[],
  displayCurrency: DisplayCurrency,
  valuation?: KlydeWalletSnapshot['valuation'],
  rates?: KlydeRates,
): string {
  if (runtimeConfig.zamaMobileRuntimeEnabled) {
    return createPrivateTotalDisplay(balances, displayCurrency, rates);
  }

  if (valuation?.status === 'available') {
    return formatMoneyAmount(valuation.total);
  }

  if (displayCurrency === 'USD') {
    return '$0.00';
  }

  return balances.find((balance) => balance.code === 'NGN')?.displayAmount ?? '₦0.00';
}

function createPrivateTotalDisplay(
  balances: AppBalance[],
  displayCurrency: DisplayCurrency,
  rates?: KlydeRates,
): string {
  if (balances.some((balance) => isMaskedBalanceDisplay(balance.displayAmount))) {
    return displayCurrency === 'USD' ? '$••••' : '₦••••';
  }

  const ngnBalance = balances.find((balance) => balance.code === 'NGN');
  const ngnAmount = ngnBalance?.numericAmount ?? 0;

  if (displayCurrency === 'USD') {
    const usdRate = getRateFromBaseCurrency(rates, 'USD');
    const ngnAsUsd = usdRate ? ngnAmount * usdRate : 0;
    const stablecoinTotal = balances
      .filter((balance) => isStablecoinAssetCode(balance.code))
      .reduce((total, balance) => total + balance.numericAmount + (balance.publicNumericAmount ?? 0), 0);

    return formatDisplayNumber(stablecoinTotal + ngnAsUsd, '$');
  }

  const stablecoinAsNgn = createStablecoinLocalValue(balances, rates);

  return formatDisplayNumber(ngnAmount + stablecoinAsNgn, '₦');
}

function createStablecoinLocalValue(balances: AppBalance[], rates?: KlydeRates): number {
  return balances
    .filter((balance) => isStablecoinAssetCode(balance.code))
    .reduce((total, balance) => {
      const rate = getRateFromBaseCurrency(rates, balance.code) ?? getRateFromBaseCurrency(rates, 'USD');

      return total + (rate ? (balance.numericAmount + (balance.publicNumericAmount ?? 0)) / rate : 0);
    }, 0);
}

function getRateFromBaseCurrency(rates: KlydeRates | undefined, currency: string): number | undefined {
  if (!rates || rates.baseCurrency.toUpperCase() !== 'NGN') {
    return undefined;
  }

  const rate = rates.rates.find((item) => item.currency.toUpperCase() === currency.toUpperCase());
  const numericRate = Number(rate?.rate);

  return Number.isFinite(numericRate) && numericRate > 0 ? numericRate : undefined;
}

function createRecipientNote(beneficiary: PaayeeBeneficiary): string {
  if (beneficiary.handle) {
    return `@${beneficiary.handle.replace(/^@+/, '')}`;
  }

  if (beneficiary.bankName && beneficiary.accountNumber) {
    return `${beneficiary.bankName} ending ${beneficiary.accountNumber.slice(-4)}`;
  }

  if (beneficiary.walletAddress) {
    const network = beneficiary.networkName ? ` on ${beneficiary.networkName}` : '';

    return `${shortenAddress(beneficiary.walletAddress)}${network}`;
  }

  return 'Saved beneficiary';
}

function createRecentRecipientNote(recipient: KlydeRecentRecipient): string {
  if (recipient.destination.type === 'bank_account') {
    const bankAccount = parseBankAccountReference(recipient.destination.accountReference);

    return `${recipient.destination.bankName ?? 'Bank account'} ending ${
      bankAccount.accountNumber.slice(-4) || '----'
    }`;
  }

  if (recipient.destination.type === 'wallet') {
    return shortenAddress(recipient.destination.address);
  }

  return 'Recent withdrawal';
}

function parseBankAccountReference(accountReference: string): {
  accountName?: string;
  accountNumber: string;
  bankCode?: string;
} {
  const [bankCode, accountNumber, ...accountNameParts] = accountReference.split(':');

  if (!accountNumber) {
    return { accountNumber: accountReference };
  }

  return {
    accountName: accountNameParts.join(':') || undefined,
    accountNumber,
    bankCode,
  };
}

function cleanNamePart(value?: string): string {
  return value?.trim() ?? '';
}

function formatMoneyAmount(amount: MoneyAmount): string {
  const numericAmount = parseMoneyAmount(amount);
  const symbol = getCurrencySymbol(amount.currency);

  if (Number.isFinite(numericAmount)) {
    return formatDisplayNumber(numericAmount, symbol);
  }

  return `${symbol}${amount.display}`;
}

function formatMoneyAmountWithAsset(amount: MoneyAmount, options: { assetCode?: string } = {}): string {
  const formatted = formatMoneyAmount(amount);
  const assetCode = (options.assetCode ?? amount.currency).toUpperCase();

  if (isStablecoinAssetCode(assetCode)) {
    return `${formatted} ${assetCode}`;
  }

  return formatted;
}

function formatDisplayNumber(value: number, symbol: string): string {
  return `${symbol}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}`;
}

function resolveTransactionAssetCode(transaction: KlydeTransaction): string {
  return (transaction.settlementAsset?.symbol ?? transaction.amount.currency).toUpperCase();
}

function parseMoneyAmount(amount: MoneyAmount): number {
  if (amount.minorUnits && amount.scale !== undefined) {
    return Number(amount.minorUnits) / 10 ** amount.scale;
  }

  return Number(amount.display.replace(/,/g, ''));
}

function parsePrivateStablecoinDisplay(value: string, fallback: number): number {
  const numericValue = Number(value.replace(/[^\d.-]/g, ''));

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function isMaskedBalanceDisplay(value: string): boolean {
  return value.includes('••••');
}

function getCurrencySymbol(currency: string): string {
  if (currency.toUpperCase() === 'NGN') {
    return '₦';
  }

  if (currency.toUpperCase() === 'USD' || currency.toUpperCase() === 'USDC' || currency.toUpperCase() === 'USDT') {
    return '$';
  }

  return `${currency.toUpperCase()} `;
}

function isSupportedBalanceCode(code: string): code is SupportedBalanceCode {
  return supportedBalanceCodes.includes(code as SupportedBalanceCode);
}

function isStablecoinAssetCode(code: string): code is Extract<SupportedBalanceCode, 'USDC' | 'USDT'> {
  return code.toUpperCase() === 'USDC' || code.toUpperCase() === 'USDT';
}

function getAssetBadgeText(assetCode: string): string {
  const normalized = assetCode.toUpperCase();

  if (normalized === 'USDC') {
    return 'C';
  }

  if (normalized === 'USDT') {
    return 'T';
  }

  return normalized.slice(0, 1);
}

function formatTransactionDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getInitials(...parts: (string | undefined)[]): string {
  const words = parts
    .flatMap((part) => (part ?? '').trim().split(/\s+/))
    .filter(Boolean);

  if (words.length === 0) {
    return 'PY';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function shortenAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
