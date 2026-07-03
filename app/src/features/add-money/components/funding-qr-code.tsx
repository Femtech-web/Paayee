import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { toQR } from 'toqr';

import { Colors } from '@/constants/theme';

export function FundingQrCode({
  payload,
  style,
}: {
  payload: string;
  style?: StyleProp<ViewStyle>;
}) {
  const matrix = useMemo(() => {
    try {
      const modules = toQR(payload);
      const size = Math.sqrt(modules.length);

      if (!Number.isInteger(size)) {
        return undefined;
      }

      return {
        modules,
        size,
      };
    } catch {
      return undefined;
    }
  }, [payload]);

  if (!matrix) {
    return null;
  }

  return (
    <Svg
      accessibilityLabel="Wallet address QR code"
      style={style}
      viewBox={`0 0 ${matrix.size} ${matrix.size}`}>
      {Array.from(matrix.modules).map((filled, index) => {
        if (!filled) {
          return null;
        }

        const x = index % matrix.size;
        const y = Math.floor(index / matrix.size);

        return <Rect key={index} x={x} y={y} width={1} height={1} fill={Colors.light.black} />;
      })}
    </Svg>
  );
}
