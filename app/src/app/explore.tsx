import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

const rows = [
  ['Visible assets', 'USDC, USDT, NGN'],
  ['Klyde role', 'Rails, smart account, gas abstraction'],
  ['Paayee role', 'Confidential transfer and receipt privacy'],
  ['Demo status', 'Sandbox rail, production privacy boundary'],
];

export default function ExploreScreen() {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.shell}>
            <Text style={styles.title}>Privacy model</Text>
            <Text style={styles.copy}>
              Paayee keeps the payment experience simple while separating rails from privacy.
              Klyde prepares the account and NGN sandbox flow; Paayee owns the confidential
              stablecoin settlement path.
            </Text>

            <View style={styles.table}>
              {rows.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    padding: Spacing.three,
  },
  shell: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: 18,
  },
  title: {
    color: Colors.light.text,
    fontFamily: Fonts.demi,
    fontSize: 34,
    lineHeight: 40,
  },
  copy: {
    color: Colors.light.textSecondary,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 23,
  },
  table: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  label: {
    color: Colors.light.textTertiary,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  value: {
    marginTop: 4,
    color: Colors.light.text,
    fontFamily: Fonts.demi,
    fontSize: 15,
  },
});
