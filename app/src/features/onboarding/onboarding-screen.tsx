import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';

import { onboardingStyles as styles } from './onboarding-screen.styles';

type OnboardingArt = 'balances' | 'pin' | 'setup';

type OnboardingSlide = {
  eyebrow: string;
  title: string;
  text: string;
  button: string;
  art: OnboardingArt;
};

const slides: OnboardingSlide[] = [
  {
    eyebrow: 'Paayee',
    title: 'One account for everyday money',
    text: 'Keep NGN, USDC, and USDT close, then send through bank accounts, Paayee handles, or supported wallets.',
    button: 'Continue',
    art: 'balances',
  },
  {
    eyebrow: 'Security',
    title: 'Approve sensitive moves with your PIN',
    text: 'Your PIN protects transfers, withdrawals, and account changes without slowing down the everyday flow.',
    button: 'Continue',
    art: 'pin',
  },
  {
    eyebrow: 'First steps',
    title: 'Set up only what matters now',
    text: 'Create your handle, secure your account, and add money when you are ready to start sending.',
    button: 'Enter Paayee',
    art: 'setup',
  },
];

export function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];
  const isLastSlide = activeIndex === slides.length - 1;

  const completeOnboarding = () => {
    router.replace('/?onboardingDone=1' as Href);
  };

  const goNext = () => {
    if (isLastSlide) {
      completeOnboarding();
      return;
    }

    setActiveIndex((current) => current + 1);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.shell}>
          <View style={styles.topBar}>
            <Text style={styles.brand}>paayee</Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              onPress={completeOnboarding}>
              <Text style={styles.skip}>Skip</Text>
            </PressableScale>
          </View>

          <FadeInView key={activeSlide.title} distance={14} style={styles.content}>
            <OnboardingVisual type={activeSlide.art} />

            <View style={styles.copy}>
              <Text style={styles.eyebrow}>{activeSlide.eyebrow}</Text>
              <Text style={styles.title}>{activeSlide.title}</Text>
              <Text style={styles.text}>{activeSlide.text}</Text>
            </View>
          </FadeInView>

          <View style={styles.footer}>
            <View accessibilityRole="progressbar" style={styles.progressRow}>
              {slides.map((slide, index) => (
                <View
                  key={slide.title}
                  style={[styles.progressDot, index === activeIndex && styles.progressDotActive]}
                />
              ))}
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={activeSlide.button}
              onPress={goNext}
              style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{activeSlide.button}</Text>
            </PressableScale>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function OnboardingVisual({ type }: { type: OnboardingArt }) {
  if (type === 'pin') {
    return (
      <View style={styles.artStage}>
        <View style={styles.lockCard}>
          <View style={styles.artBadge}>
            <Feather name="lock" size={25} color={Colors.light.white} />
          </View>
          <View style={styles.lockDots}>
            <View style={styles.lockDot} />
            <View style={styles.lockDot} />
            <View style={styles.lockDot} />
            <View style={styles.lockDot} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'setup') {
    const setupRows = [
      { icon: 'at-sign', label: 'Choose your handle' },
      { icon: 'key', label: 'Create your PIN' },
      { icon: 'plus', label: 'Add your first balance' },
    ] as const;

    return (
      <View style={styles.artStage}>
        <View style={styles.setupStack}>
          {setupRows.map((row) => (
            <View key={row.label} style={styles.setupRow}>
              <View style={styles.setupIcon}>
                <Feather name={row.icon} size={17} color={Colors.light.primary} />
              </View>
              <Text style={styles.setupText}>{row.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.artStage}>
      <View style={styles.privateCardBack} />
      <View style={styles.privateCard}>
        <Text style={styles.cardText}>Total balance</Text>
        <Text style={styles.cardAmount}>$174.27</Text>
        <Text style={styles.cardText}>NGN · USDC · USDT</Text>
      </View>
      <View style={styles.railCoin}>
        <Text style={styles.railCoinText}>₦</Text>
      </View>
    </View>
  );
}
