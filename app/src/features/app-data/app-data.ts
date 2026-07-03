import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getKlydeWalletSnapshot,
  listKlydeRecentRecipients,
  listKlydeTransactions,
  type KlydeBalance,
  type KlydeRecentRecipient,
  type KlydeTransaction,
  type KlydeWallet,
  type KlydeWalletSnapshot,
  type MoneyAmount,
} from '@/integrations/klyde/client';
import {
  getCurrentProfile,
  listCurrentBeneficiaries,
  type PaayeeBeneficiary,
  type PaayeeProfile,
} from '@/integrations/supabase';

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
  displayAmount: string;
  icon: 'ngn' | 'usdc' | 'usdt';
  label: string;
  name: string;
  numericAmount: number;
};

export type AppRecipient = {
  accountNumber?: string;
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
  detail: string;
  icon?: 'arrow-down-left' | 'eye' | 'repeat' | 'shield' | 'trending-up';
  id: string;
  initials?: string;
  kind: KlydeTransaction['kind'];
  receiptId?: string;
  secondaryAmount?: string;
  title: string;
  tone?: 'negative' | 'positive' | 'receipt';
  when: string;
};

export type AppData = {
  balances: AppBalance[];
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
  refresh: (options?: { silent?: boolean }) => Promise<void>;
};

const emptyProfile: AppProfile = {
  email: '',
  firstName: 'there',
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
  },
  {
    code: 'USDC',
    displayAmount: '$0.00',
    icon: 'usdc',
    label: 'Private dollar balance',
    name: 'USD Coin',
    numericAmount: 0,
  },
  {
    code: 'USDT',
    displayAmount: '$0.00',
    icon: 'usdt',
    label: 'Private tether balance',
    name: 'Tether USD',
    numericAmount: 0,
  },
];

const supportedBalanceCodes = ['NGN', 'USDC', 'USDT'] as const;
type SupportedBalanceCode = (typeof supportedBalanceCodes)[number];

export function useAppData(): AppDataState {
  const [data, setData] = useState<AppData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const hasLoadedInitialData = useRef(false);

  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    setError(undefined);

    try {
      setData(await loadAppData());
    } catch (fetchError) {
      setData(createEmptyAppData());
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load account data.');
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
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

async function loadAppData(): Promise<AppData> {
  const [profile, beneficiaries, klydeSnapshot, klydeTransactions, recentRecipients] = await Promise.all([
    getCurrentProfile(),
    listCurrentBeneficiaries(),
    getKlydeWalletSnapshot({ baseCurrency: 'NGN' }).catch(() => undefined),
    listKlydeTransactions({ page: 1, pageSize: 10 }).catch(() => undefined),
    listKlydeRecentRecipients({ limit: 10 }).catch(() => []),
  ]);
  const balances = normalizeBalances(klydeSnapshot?.balances);
  const transactions = klydeTransactions?.data.map(normalizeTransaction) ?? [];
  const recipients = [
    ...beneficiaries.map(normalizeBeneficiary),
    ...recentRecipients.map(normalizeRecentRecipient),
  ];

  return {
    balances,
    profile: normalizeProfile(profile, klydeSnapshot?.wallet),
    recipients,
    totalDisplay: createTotalDisplay(balances, klydeSnapshot?.valuation),
    transactions,
    wallet: klydeSnapshot?.wallet,
  };
}

function createEmptyAppData(): AppData {
  return {
    balances: emptyBalances,
    profile: emptyProfile,
    recipients: [],
    totalDisplay: '₦0.00',
    transactions: [],
  };
}

function normalizeProfile(profile?: PaayeeProfile, wallet?: KlydeWallet): AppProfile {
  const firstName = cleanNamePart(profile?.firstName) || 'there';
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
  const accountNumber =
    recipient.destination.type === 'bank_account'
      ? recipient.destination.accountReference
      : undefined;
  const walletAddress =
    recipient.destination.type === 'wallet' ? recipient.destination.address : undefined;

  return {
    accountNumber,
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

    return {
      ...emptyBalance,
      displayAmount: formatMoneyAmount(balance.total),
      numericAmount: parseMoneyAmount(balance.total),
    };
  });
}

function normalizeTransaction(transaction: KlydeTransaction): AppTransaction {
  const isIncoming = transaction.kind === 'deposit';
  const amount = formatMoneyAmount(transaction.amount);
  const settlementAmount = transaction.settlementAmount
    ? formatMoneyAmount(transaction.settlementAmount)
    : undefined;

  return {
    amount: `${isIncoming ? '+' : '-'}${amount}`,
    detail: createTransactionDetail(transaction),
    icon: isIncoming ? 'arrow-down-left' : 'trending-up',
    id: transaction.id,
    kind: transaction.kind,
    receiptId: transaction.receiptId,
    secondaryAmount: settlementAmount,
    title: createTransactionTitle(transaction),
    tone: isIncoming ? 'positive' : 'negative',
    when: formatTransactionDate(transaction.createdAt),
  };
}

function createTransactionTitle(transaction: KlydeTransaction): string {
  if (transaction.kind === 'deposit') {
    return `${transaction.amount.currency} deposit`;
  }

  if (transaction.kind === 'withdrawal') {
    return `${transaction.amount.currency} withdrawal`;
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

  return `${status}${reference}`;
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
  valuation?: KlydeWalletSnapshot['valuation'],
): string {
  if (valuation?.status === 'available' && valuation.total.currency.toUpperCase() === 'NGN') {
    return formatMoneyAmount(valuation.total);
  }

  return balances.find((balance) => balance.code === 'NGN')?.displayAmount ?? '₦0.00';
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
    return `${recipient.destination.bankName ?? 'Bank account'} ending ${recipient.destination.accountReference.slice(-4)}`;
  }

  if (recipient.destination.type === 'wallet') {
    return shortenAddress(recipient.destination.address);
  }

  return 'Recent withdrawal';
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

function formatDisplayNumber(value: number, symbol: string): string {
  return `${symbol}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}`;
}

function parseMoneyAmount(amount: MoneyAmount): number {
  if (amount.minorUnits && amount.scale !== undefined) {
    return Number(amount.minorUnits) / 10 ** amount.scale;
  }

  return Number(amount.display.replace(/,/g, ''));
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
