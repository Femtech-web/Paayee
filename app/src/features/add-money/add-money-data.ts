import {
  sendAssetOptions,
  stablecoinNetworks,
  type SendAssetCode,
  type SendAssetOption,
} from '@/features/send/send-data';

export const addMoneyAssets = sendAssetOptions;

export const addMoneyStablecoinCodes: SendAssetCode[] = ['USDC', 'USDT'];

export const addMoneyDefaultAsset = sendAssetOptions[0];

export const addMoneyDepositAddress = '0xE7f8AAb397c71a13cB84E860AD9cBd241665085D';

export const addMoneyNetworks = stablecoinNetworks;

export function findAddMoneyAsset(code?: string | string[]) {
  const normalized = Array.isArray(code) ? code[0] : code;
  return (
    sendAssetOptions.find((asset) => asset.code.toLowerCase() === normalized?.toLowerCase()) ??
    addMoneyDefaultAsset
  );
}

export function isStablecoinAsset(asset: SendAssetOption) {
  return addMoneyStablecoinCodes.includes(asset.code);
}

export function getSourceAsset(targetAsset: SendAssetOption) {
  if (targetAsset.code === 'NGN') {
    return sendAssetOptions.find((asset) => asset.code === 'USDC') ?? sendAssetOptions[0];
  }

  return sendAssetOptions.find((asset) => asset.code === 'NGN') ?? sendAssetOptions[0];
}
