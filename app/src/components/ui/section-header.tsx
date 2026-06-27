import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type SectionHeaderProps = {
  action?: string;
  title: string;
};

export function SectionHeader({ action, title }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: Colors.light.textTertiary,
    fontFamily: Fonts.demi,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  action: {
    color: Colors.light.primary,
    fontFamily: Fonts.demi,
    fontSize: 13,
  },
});
