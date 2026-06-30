import { Feather } from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import type React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { sendStyles as styles } from '../../send-screen.styles';

export function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.shell}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function TopBar({ centeredTitle }: { centeredTitle?: string }) {
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
      {centeredTitle ? <Text style={styles.topTitle}>{centeredTitle}</Text> : <View style={{ flex: 1 }} />}
      <View style={styles.topSpacer} />
    </FadeInView>
  );
}
