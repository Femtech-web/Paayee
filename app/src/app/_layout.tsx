import '@/features/confidential/zama-runtime-polyfills';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AnimatedSplashScreen } from '@/components/brand/animated-splash-screen';
import { AppTabBar } from '@/components/navigation/app-tab-bar';
import { Colors } from '@/constants/theme';
import { SessionGuard } from '@/features/auth';
import { installPaayeeKlydeSmartAccountTransport } from '@/features/confidential/klyde-smart-account-transport';

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function TabLayout() {
  const [splashFinished, setSplashFinished] = useState(false);

  useEffect(() => {
    installPaayeeKlydeSmartAccountTransport();
    SplashScreen.hideAsync().catch(() => null);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.light.background },
        }}
      />
      <SessionGuard />
      <AppTabBar />
      {!splashFinished ? (
        <AnimatedSplashScreen onFinish={() => setSplashFinished(true)} />
      ) : null}
    </View>
  );
}
