import { type Href } from 'expo-router';

import {
  sendAssetOptions,
  sendRecipients,
  type SendAssetCode,
  type SendAssetOption,
  type SendRecipient,
  type StablecoinNetworkOption,
} from '../../send-data';

export const defaultRecipient = sendRecipients[0];

export function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value || 0);
}

export function formatMoney(value: number, asset: SendAssetOption) {
  return `${asset.symbol}${formatNumber(value)}`;
}

export function findAsset(code?: SendAssetCode) {
  return sendAssetOptions.find((asset) => asset.code === code) ?? sendAssetOptions[0];
}

export function getTransferFee(code: SendAssetCode) {
  if (code === 'NGN') {
    return 35;
  }

  return 0;
}

export function convertAmount(amount: number, sendAsset: SendAssetOption, receiveAsset: SendAssetOption) {
  if (sendAsset.code === receiveAsset.code) {
    return amount;
  }

  if (sendAsset.code === 'USDC' && receiveAsset.code === 'USDT') {
    return Math.floor(amount * 0.998);
  }

  if (sendAsset.code === 'USDT' && receiveAsset.code === 'USDC') {
    return Math.floor(amount * 0.997);
  }

  if (sendAsset.code === 'NGN') {
    return Math.floor(amount / 1485);
  }

  if (receiveAsset.code === 'NGN') {
    return Math.floor(amount * 1485);
  }

  return amount;
}

export function readRateLabel(sendAsset: SendAssetOption, receiveAsset: SendAssetOption) {
  if (sendAsset.code === 'NGN') {
    return '÷ 1,485';
  }

  if (receiveAsset.code === 'NGN') {
    return '× 1,485';
  }

  return '× 0.998';
}

export function createBankAmountHref(recipient: SendRecipient) {
  return `/send/bank/amount?name=${encodeURIComponent(recipient.name)}&bank=${encodeURIComponent(
    recipient.bankName,
  )}&account=${recipient.accountNumber}&initials=${recipient.initials}` as Href;
}

export function createHandleAmountHref(recipient: SendRecipient) {
  return `/send/handle/amount?name=${encodeURIComponent(recipient.name)}&bank=${encodeURIComponent(
    recipient.bankName,
  )}&account=${encodeURIComponent(recipient.accountNumber)}&initials=${recipient.initials}` as Href;
}

export function createStablecoinAmountHref({
  address,
  asset,
  network,
}: {
  address: string;
  asset: SendAssetCode;
  network: StablecoinNetworkOption;
}) {
  return `/send/stablecoin/amount?name=${encodeURIComponent(network.name)}&bank=&account=${encodeURIComponent(
    address,
  )}&initials=SC&asset=${asset}` as Href;
}
