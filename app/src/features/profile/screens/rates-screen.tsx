import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { profileRates as rates } from '../profile-data';
import { profileStyles as styles } from '../profile-screen.styles';

export function RatesScreen() {
  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Our rates</Text>
        <Text style={styles.subtitle}>View supported Paayee conversion rates at a glance.</Text>
      </FadeInView>
      <FadeInView delay={110} style={styles.ratesGrid}>
        {rates.map(([from, to, forward, reverse]) => (
          <View key={`${from}-${to}`} style={styles.rateRow}>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>
                {from} → {to}
              </Text>
              <Text style={styles.rateValue}>{forward}</Text>
            </View>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>
                {to} → {from}
              </Text>
              <Text style={styles.rateValue}>{reverse}</Text>
            </View>
          </View>
        ))}
      </FadeInView>
    </ProfileShell>
  );
}
