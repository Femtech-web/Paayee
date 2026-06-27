import { Feather } from '@react-native-vector-icons/feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type PrimaryButtonProps = {
  icon?: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress?: () => void;
  variant?: 'dark' | 'orange' | 'soft';
};

export function PrimaryButton({ icon, label, onPress, variant = 'dark' }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.label, variant === 'soft' && styles.labelSoft]}>{label}</Text>
      {icon ? (
        <Feather
          name={icon}
          size={18}
          color={variant === 'soft' ? Colors.light.black : Colors.light.white}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  dark: {
    backgroundColor: Colors.light.black,
  },
  orange: {
    backgroundColor: Colors.light.primary,
  },
  soft: {
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pressed: {
    opacity: 0.86,
  },
  label: {
    color: Colors.light.white,
    fontFamily: Fonts.demi,
    fontSize: 15,
  },
  labelSoft: {
    color: Colors.light.black,
  },
});
