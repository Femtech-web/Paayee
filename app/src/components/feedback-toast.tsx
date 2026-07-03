import { Feather } from '@react-native-vector-icons/feather';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type FeedbackTone = 'error' | 'info' | 'success';

const toneConfig: Record<
  FeedbackTone,
  {
    backgroundColor: string;
    borderColor: string;
    color: string;
    icon: ComponentProps<typeof Feather>['name'];
  }
> = {
  error: {
    backgroundColor: '#FFF7F5',
    borderColor: '#F4D3CD',
    color: '#A43F34',
    icon: 'alert-circle',
  },
  info: {
    backgroundColor: '#F7F8FB',
    borderColor: '#E1E4EA',
    color: '#4C5361',
    icon: 'info',
  },
  success: {
    backgroundColor: '#F3FBF6',
    borderColor: '#CBEBD9',
    color: Colors.light.success,
    icon: 'check-circle',
  },
};

export function FeedbackToast({
  floating = false,
  message,
  tone = 'info',
}: {
  floating?: boolean;
  message?: string;
  tone?: FeedbackTone;
}) {
  if (!message) {
    return null;
  }

  const config = toneConfig[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        floating && styles.floatingToast,
        { backgroundColor: config.backgroundColor, borderColor: config.borderColor },
      ]}>
      <View style={styles.icon}>
        <Feather name={config.icon} size={16} color={config.color} />
      </View>
      <Text style={[styles.text, { color: config.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  floatingToast: {
    position: 'absolute',
    top: Platform.select({ ios: 10, default: 8 }),
    left: 16,
    right: 16,
    zIndex: 50,
    marginTop: 0,
    shadowColor: '#17120E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
