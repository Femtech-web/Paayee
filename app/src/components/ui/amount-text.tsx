import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type AmountTextProps = {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<TextStyle>;
  value: string;
};

export function AmountText({ color = Colors.light.black, size = 'md', style, value }: AmountTextProps) {
  return <Text style={[styles.base, styles[size], { color }, style]}>{value}</Text>;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Fonts.demi,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  sm: {
    fontSize: 14,
    lineHeight: 18,
  },
  md: {
    fontSize: 20,
    lineHeight: 26,
  },
  lg: {
    fontSize: 38,
    lineHeight: 50,
  },
});
