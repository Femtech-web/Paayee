export type AssetCode = 'ngn' | 'usdc' | 'usdt';

export type AssetNetwork = {
  label: string;
  selected?: boolean;
};

export type AssetDetail = {
  code: AssetCode;
  displayCode: string;
  title: string;
  balanceLabel: string;
  balance: string;
  receiveTitle: string;
  receiveSubtitle: string;
  depositNote: string;
  address?: string;
  networks?: AssetNetwork[];
};

export const assetDetails: Record<AssetCode, AssetDetail> = {
  ngn: {
    code: 'ngn',
    displayCode: 'NGN',
    title: 'Nigerian Naira',
    balanceLabel: 'Your NGN balance',
    balance: '₦2,850,000',
    receiveTitle: 'Receive NGN',
    receiveSubtitle: 'Add money to your Paayee NGN balance',
    depositNote:
      'Paayee will show funding instructions and update your balance when the deposit is confirmed.',
  },
  usdc: {
    code: 'usdc',
    displayCode: 'USDC',
    title: 'USD Coin',
    balanceLabel: 'Your USDC balance',
    balance: '$4,280.40',
    receiveTitle: 'Receive USDC',
    receiveSubtitle: 'Fund your private USDC balance',
    depositNote:
      'Only send USDC on Sepolia to this address. Paayee will credit the private balance after confirmation.',
    address: '0xE7f8AAb397c71a13cB84E86OAD9cBd241665085D',
    networks: [{ label: 'Sepolia', selected: true }],
  },
  usdt: {
    code: 'usdt',
    displayCode: 'USDT',
    title: 'Tether USD',
    balanceLabel: 'Your USDT balance',
    balance: '$1,840.00',
    receiveTitle: 'Receive USDT',
    receiveSubtitle: 'Fund your private USDT balance',
    depositNote:
      'Only send USDT on Sepolia to this address. Paayee will credit the private balance after confirmation.',
    address: '0x7Ab6649B81a1c6ddO3f2EC52ED43OBeB93606AEc',
    networks: [{ label: 'Sepolia', selected: true }],
  },
};

export function isAssetCode(value: string): value is AssetCode {
  return value === 'ngn' || value === 'usdc' || value === 'usdt';
}
