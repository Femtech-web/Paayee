import { Feather } from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';

import { authStyles as styles } from '../auth-screen.styles';

export function AuthShell({
  children,
  onBack,
  showBack = false,
  showBrand = true,
  showTopBar = true,
}: {
  children: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  showBrand?: boolean;
  showTopBar?: boolean;
}) {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', default: undefined })}
          style={styles.keyboard}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <View style={styles.shell}>
              {showTopBar ? (
                <View style={styles.topBar}>
                  {showBack ? (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                      onPress={
                        onBack ??
                        (() => {
                          if (router.canGoBack()) {
                            router.back();
                          }
                        })
                      }
                      style={styles.backButton}>
                      <Feather name="chevron-left" size={25} color={Colors.light.black} />
                    </PressableScale>
                  ) : showBrand ? (
                    <Text style={styles.brand}>paayee</Text>
                  ) : (
                    <View />
                  )}
                </View>
              ) : null}
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
