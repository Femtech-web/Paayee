import { Image, StyleSheet, View } from 'react-native';

import UsdcLogo from '../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../assets/icons/usdt.svg';
import { Colors } from '@/constants/theme';

const nigeriaFlag = require('../../../assets/images/nigeria.png');

type AssetBadgeProps = {
  code: 'NGN' | 'USDC' | 'USDT';
  size?: 'sm' | 'md';
};

export function AssetBadge({ code, size = 'md' }: AssetBadgeProps) {
  const dimensions = size === 'md' ? styles.assetMd : styles.assetSm;
  const logoSize = size === 'md' ? 38 : 28;

  return (
    <View style={[styles.asset, dimensions]}>
      {code === 'NGN' ? (
        <Image source={nigeriaFlag} style={[styles.flag, dimensions]} />
      ) : code === 'USDC' ? (
        <UsdcLogo width={logoSize} height={logoSize} />
      ) : (
        <UsdtLogo width={logoSize} height={logoSize} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  asset: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundElement,
  },
  assetMd: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  assetSm: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  flag: {
    resizeMode: 'cover',
  },
});
