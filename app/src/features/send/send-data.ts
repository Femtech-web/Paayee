export type SendRecipient = {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  handle?: string;
  initials: string;
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
  id: string;
  name: string;
  shortName: string;
};

export const sendRecipients: SendRecipient[] = [
  {
    id: 'akolade-first-bank',
    name: 'Akolade Oluwafemi Adeyemi',
    bankName: 'First Bank PLC',
    accountNumber: '3183073678',
    initials: 'AO',
  },
  {
    id: 'titilayo-monipoint',
    name: 'Titilayo Rebecca Bamigbade',
    bankName: 'Moniepoint Microfinance Bank',
    accountNumber: '8118981776',
    initials: 'TR',
  },
  {
    id: 'cowrywise-gtb',
    name: 'Cowrywise Oluwafemi Adeyemi Akolade',
    bankName: 'Guaranty Trust Bank',
    accountNumber: '9002053066',
    initials: 'CO',
  },
  {
    id: 'angela-opay',
    name: 'Angela Tantvi Peter',
    bankName: 'Opay',
    accountNumber: '7068955766',
    initials: 'AT',
  },
];

export const paayeeHandleRecipients: SendRecipient[] = [
  {
    id: 'timileyin-christiana',
    name: 'Timileyin Fakayode',
    bankName: 'Paayee handle',
    accountNumber: '@christiana',
    handle: 'christiana',
    initials: 'TF',
  },
  {
    id: 'ada-paayee',
    name: 'Ada Lin',
    bankName: 'Paayee handle',
    accountNumber: '@ada',
    handle: 'ada',
    initials: 'AL',
  },
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
    id: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
  },
];

export const transferPurposes = ['General', 'Family', 'Bills', 'Savings', 'Business'] as const;

export const sendAssetOptions: SendAssetOption[] = [
  {
    balance: '181,329.75',
    code: 'NGN',
    group: 'Local money',
    name: 'Nigerian Naira',
    symbol: '₦',
  },
  {
    balance: '4,280.40',
    code: 'USDC',
    group: 'Stablecoins',
    name: 'USDC',
    symbol: '$',
  },
  {
    balance: '1,840.00',
    code: 'USDT',
    group: 'Stablecoins',
    name: 'USDT',
    symbol: '$',
  },
];
