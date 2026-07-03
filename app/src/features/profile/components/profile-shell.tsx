import { Feather } from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';

import { profileStyles as styles } from '../profile-screen.styles';

export function ProfileShell({
  children,
  detail = false,
}: {
  children: ReactNode;
  detail?: boolean;
}) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={detail ? styles.detailScrollContent : styles.scrollContent}>
          <View style={styles.shell}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function BackBar() {
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
