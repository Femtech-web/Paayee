import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { Colors } from '@/constants/theme';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { LimitBlock, SettingsRow } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function TransactionLimitsScreen() {
  const router = useRouter();

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Transaction limits</Text>
      </FadeInView>
      <View style={styles.sectionCard}>
        <SettingsRow
          icon="arrow-up-right"
          title="Withdrawal limits"
          onPress={() => router.push('/profile/limits/withdrawal' as Href)}
        />
        <SettingsRow
          icon="arrow-down-left"
          title="Deposit limits"
          isLast
          onPress={() => router.push('/profile/limits/deposit' as Href)}
        />
      </View>
    </ProfileShell>
  );
}

export function WithdrawalLimitsScreen() {
  return (
    <LimitDetailScreen
      title="Withdrawal limits"
      subtitle="Limits for sending money from balances to any recipient."
      daily="$10,000"
      dailyRemaining="$10,000 remaining"
      monthly="$35,000"
      monthlyRemaining="$34,025 remaining"
      monthlyProgress={0.04}
    />
  );
}

export function DepositLimitsScreen() {
  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Deposit limits</Text>
        <Text style={styles.subtitle}>Limits for making payments into balances.</Text>
      </FadeInView>

      <FadeInView delay={100} style={styles.section}>
        <Text style={styles.sectionTitle}>Bank account deposits</Text>
        <View style={styles.noteCard}>
          <Feather name="info" size={18} color={Colors.light.primary} />
          <Text style={styles.noteText}>
            NGN bank deposits have no fixed daily limit, but unusual deposits may require review.
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={130} style={styles.section}>
        <Text style={styles.sectionTitle}>Stablecoin deposits</Text>
        <View style={styles.detailCard}>
          <LimitBlock title="Daily limit: $10,000" remaining="$10,000 remaining" progress={0} />
          <LimitBlock title="Monthly limit: $30,000" remaining="$28,860 remaining" progress={0.05} />
        </View>
      </FadeInView>
    </ProfileShell>
  );
}

function LimitDetailScreen({
  daily,
  dailyRemaining,
  monthly,
  monthlyProgress,
  monthlyRemaining,
  subtitle,
  title,
}: {
  daily: string;
  dailyRemaining: string;
  monthly: string;
  monthlyProgress: number;
  monthlyRemaining: string;
  subtitle: string;
  title: string;
}) {
  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </FadeInView>
      <FadeInView delay={110} style={styles.detailCard}>
        <LimitBlock title={`Daily limit: ${daily}`} remaining={dailyRemaining} progress={0} />
        <LimitBlock title={`Monthly limit: ${monthly}`} remaining={monthlyRemaining} progress={monthlyProgress} />
      </FadeInView>
    </ProfileShell>
  );
}
