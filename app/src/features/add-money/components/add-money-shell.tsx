import { Feather } from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';

import { addMoneyStyles as styles } from '../add-money-screen.styles';

export function AddMoneyShell({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.shell}>{children}</View>
        </ScrollView>
        {overlay ? (
          <View pointerEvents="box-none" style={styles.shellOverlay}>
            {overlay}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

export function TopBar() {
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
      <View style={styles.topSpacer} />
    </FadeInView>
  );
}
