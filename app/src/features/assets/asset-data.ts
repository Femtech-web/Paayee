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
  publicTokenAddress?: string;
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
    receiveSubtitle: 'Fund your public USDC balance, then make it private when ready',
    depositNote:
      'Only send Sepolia USDC to this Privy wallet. Shielding it into private cUSDC is a separate onchain step.',
    publicTokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    networks: [{ label: 'Sepolia', selected: true }],
  },
  usdt: {
    code: 'usdt',
    displayCode: 'USDT',
    title: 'Tether USD',
    balanceLabel: 'Your USDT balance',
    balance: '$0.00',
    receiveTitle: 'Receive USDT',
    receiveSubtitle: 'Fund your public USDT balance, then make it private when ready',
    depositNote:
      'Only send Paayee Sepolia USDT to this Privy wallet. Shielding it into private cUSDT is a separate onchain step.',
    publicTokenAddress: '0x93C5d30a7509E60871B77A3548a5BD913334cd35',
    networks: [{ label: 'Sepolia', selected: true }],
  },
};

export function isAssetCode(value: string): value is AssetCode {
  return value === 'ngn' || value === 'usdc' || value === 'usdt';
}
