import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/features/app-data';
import { setupStyles as styles } from './ngn-account-setup-screen.styles';

type NgnAccountSetupScreenProps = {
  step: 'confirm-name' | 'review';
};

export function NgnAccountSetupScreen({ step }: NgnAccountSetupScreenProps) {
  if (step === 'review') {
    return <AccountReview />;
  }

  return <ConfirmName />;
}

function ConfirmName() {
  const router = useRouter();
  const { data } = useAppData();
  const userDetails = [
    { label: 'First name', value: data?.profile.firstName || 'Not provided' },
    { label: 'Last name', value: data?.profile.lastName || 'Not provided' },
    { label: 'Email', value: data?.profile.email || 'Not provided' },
  ];

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.shell}>
          <TopBackButton />

          <FadeInView delay={60} style={styles.content}>
            <Text style={styles.kicker}>NGN funding setup</Text>
            <Text style={styles.title}>Confirm your name</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Confirm these details before Paayee creates your funding route.
              </Text>
            </View>

            <View style={styles.detailsList}>
              {userDetails.map((detail) => (
                <View key={detail.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{detail.label}</Text>
                  <Text style={styles.detailValue}>{detail.value}</Text>
                </View>
              ))}
            </View>
          </FadeInView>

          <View style={styles.footer}>
            <PressableScale
              onPress={() => router.push('/asset/ngn/account-review' as Href)}
              style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Yes, it is correct</Text>
            </PressableScale>
            <PressableScale onPress={() => router.back()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel and go back</Text>
            </PressableScale>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function AccountReview() {
  const router = useRouter();
  const { data } = useAppData();

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.shell}>
          <TopBackButton />

          <FadeInView style={styles.reviewContent}>
            <Text style={styles.kicker}>NGN funding route</Text>
            <Text style={styles.title}>NGN funding route ready</Text>
            <Text style={styles.subtitle}>
              Your Paayee profile is ready for NGN funding. Account instructions will appear here
              once your funding route is assigned.
            </Text>

            <View style={styles.readyCard}>
              <View style={styles.readyHeader}>
                <View style={styles.readyIcon}>
                  <Feather name="check" size={18} color={Colors.light.white} />
                </View>
                <View>
                  <Text style={styles.readyTitle}>Funding route active</Text>
                  <Text style={styles.readyText}>Provider: Paayee bank transfer</Text>
                </View>
              </View>

              <View style={styles.instructionList}>
                <InstructionRow label="Account owner" value={data?.profile.name ?? 'Paayee user'} />
                <InstructionRow label="Status" value="Funding route pending" />
                <InstructionRow label="Balance" value="NGN" />
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                We will show bank details and references here as soon as they are available.
              </Text>
            </View>
          </FadeInView>

          <View style={styles.footer}>
            <PressableScale
              onPress={() => router.replace('/asset/ngn' as Href)}
              style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </PressableScale>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function InstructionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.instructionRow}>
      <View style={styles.instructionCopy}>
        <Text style={styles.instructionLabel}>{label}</Text>
        <Text selectable style={styles.instructionValue}>
          {value}
        </Text>
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel={`Copy ${label}`}>
        <View style={styles.copyButton}>
          <Feather name="copy" size={16} color={Colors.light.primary} />
        </View>
      </PressableScale>
    </View>
  );
}

function TopBackButton() {
  const router = useRouter();

  return (
    <FadeInView style={styles.topBar}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.backButton}>
        <Feather name="chevron-left" size={26} color={Colors.light.black} />
      </PressableScale>
    </FadeInView>
  );
}
