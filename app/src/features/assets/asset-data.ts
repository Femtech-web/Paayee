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
    balance: '₦0.00',
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
    balance: '$0.00',
    receiveTitle: 'Receive USDC',
    receiveSubtitle: 'Fund your private USDC balance',
    depositNote:
      'Only send USDC on Sepolia to this address. Paayee will credit the private balance after confirmation.',
    address: '0xE7f8AAb397c71a13cB84E860AD9cBd241665085D',
    networks: [{ label: 'Sepolia', selected: true }],
  },
  usdt: {
    code: 'usdt',
    displayCode: 'USDT',
    title: 'Tether USD',
    balanceLabel: 'Your USDT balance',
    balance: '$0.00',
    receiveTitle: 'Receive USDT',
    receiveSubtitle: 'Fund your private USDT balance',
    depositNote:
      'Only send USDT on Sepolia to this address. Paayee will credit the private balance after confirmation.',
    address: '0x7Ab6649B81a1c6dd03f2EC52ED430BeB93606AEc',
    networks: [{ label: 'Sepolia', selected: true }],
  },
};

export function isAssetCode(value: string): value is AssetCode {
  return value === 'ngn' || value === 'usdc' || value === 'usdt';
}
