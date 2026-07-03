import type { AppBalance, AppRecipient } from '@/features/app-data';

export type SendRecipient = {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  handle?: string;
  initials: string;
  walletAddress?: string;
};

export type BankOption = {
  id: string;
  name: string;
};

export type SendAssetCode = 'NGN' | 'USDC' | 'USDT';

export type SendAssetOption = {
  balance: string;
  code: SendAssetCode;
  group: 'Local money' | 'Stablecoins';
  name: string;
  symbol: string;
};

export type StablecoinNetworkOption = {
  chainId: number;
  id: string;
  name: string;
  shortName: string;
};

export const sendRecipients: SendRecipient[] = [
];

export const paayeeHandleRecipients: SendRecipient[] = [
];

export const bankOptions: BankOption[] = [
  { id: 'access', name: 'Access Bank' },
  { id: 'first-bank', name: 'First Bank PLC' },
  { id: 'gtb', name: 'Guaranty Trust Bank' },
  { id: 'kuda', name: 'Kuda Microfinance Bank' },
  { id: 'moniepoint', name: 'Moniepoint Microfinance Bank' },
  { id: 'opay', name: 'Opay' },
  { id: 'palmpay', name: 'PalmPay' },
  { id: 'providus', name: 'Providus Bank' },
  { id: 'uba', name: 'United Bank for Africa' },
  { id: 'zenith', name: 'Zenith Bank' },
];

export const stablecoinNetworks: StablecoinNetworkOption[] = [
  {
    chainId: 11155111,
    id: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
  },
];

export const transferPurposes = ['General', 'Family', 'Bills', 'Savings', 'Business'] as const;

export const sendAssetOptions: SendAssetOption[] = [
  {
    balance: '0.00',
    code: 'NGN',
    group: 'Local money',
    name: 'Nigerian Naira',
    symbol: '₦',
  },
  {
    balance: '0.00',
    code: 'USDC',
    group: 'Stablecoins',
    name: 'USDC',
    symbol: '$',
  },
  {
    balance: '0.00',
    code: 'USDT',
    group: 'Stablecoins',
    name: 'USDT',
    symbol: '$',
  },
];

export const fallbackBankRecipient: SendRecipient = {
  accountNumber: '',
  bankName: 'Bank account',
  id: 'bank-recipient',
  initials: 'PY',
  name: 'Recipient',
};

export const fallbackHandleRecipient: SendRecipient = {
  accountNumber: '@recipient',
  bankName: 'Paayee handle',
  handle: 'recipient',
  id: 'handle-recipient',
  initials: 'PY',
  name: 'Recipient',
};

export function createSendAssetOptionsFromBalances(balances?: AppBalance[]): SendAssetOption[] {
  if (!balances?.length) {
    return sendAssetOptions;
  }

  return sendAssetOptions.map((asset) => {
    const balance = balances.find((item) => item.code === asset.code);

    if (!balance) {
      return asset;
    }

    return {
      ...asset,
      balance: stripCurrencySymbol(balance.displayAmount),
      name: balance.name,
    };
  });
}

export function findSendAssetOption(code?: string, assets: SendAssetOption[] = sendAssetOptions) {
  return (
    assets.find((asset) => asset.code.toLowerCase() === code?.toLowerCase()) ?? assets[0]
  );
}

export function toBankSendRecipient(recipient: AppRecipient): SendRecipient | null {
  if (!recipient.bankName || !recipient.accountNumber) {
    return null;
  }

  return {
    accountNumber: recipient.accountNumber,
    bankName: recipient.bankName,
    id: recipient.id,
    initials: recipient.initials,
    name: recipient.name,
  };
}

export function toHandleSendRecipient(recipient: AppRecipient): SendRecipient | null {
  if (!recipient.handle) {
    return null;
  }

  const handle = recipient.handle.replace(/^@+/, '');

  return {
    accountNumber: `@${handle}`,
    bankName: 'Paayee handle',
    handle,
    id: recipient.id,
    initials: recipient.initials,
    name: recipient.name,
    walletAddress: recipient.walletAddress,
  };
}

function stripCurrencySymbol(value: string) {
  return value.replace(/^[^\d-]+/, '').trim() || '0.00';
}
