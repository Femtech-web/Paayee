import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';

import { authStyles as styles } from '../auth-screen.styles';
import { AuthShell } from './auth-shell';

export function WelcomeScreen() {
  const router = useRouter();

  return (
    <AuthShell>
      <FadeInView delay={60} style={styles.hero}>
        <View style={styles.introArt}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Private balance</Text>
            <Text style={styles.cardAmount}>$174.27</Text>
            <Text style={styles.cardLabel}>NGN · USDC · USDT</Text>
          </View>
          <View style={styles.coin}>
            <Text style={styles.coinText}>₦</Text>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Paayee</Text>
          <Text style={styles.title}>Private money movement, made simple.</Text>
          <Text style={styles.subtitle}>
            Hold NGN, USDC, and USDT in one secure account, then send through bank
            accounts, handles, or other supported apps.
          </Text>
        </View>
      </FadeInView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Create account"
          onPress={() => router.push('/auth/signup?entry=welcome' as Href)}
          style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Create account</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={() => router.push('/auth/login?entry=welcome' as Href)}
          style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Log in</Text>
        </PressableScale>
      </View>
    </AuthShell>
  );
}
