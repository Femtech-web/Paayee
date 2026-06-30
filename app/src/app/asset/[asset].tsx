import { Redirect, useLocalSearchParams } from 'expo-router';

import { AssetDetailScreen } from '@/features/assets/asset-detail-screen';
import { isAssetCode } from '@/features/assets/asset-data';

export default function AssetRoute() {
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  const assetCode = Array.isArray(asset) ? asset[0] : asset;

  if (!assetCode || !isAssetCode(assetCode)) {
    return <Redirect href="/" />;
  }

  return <AssetDetailScreen assetCode={assetCode} />;
}
