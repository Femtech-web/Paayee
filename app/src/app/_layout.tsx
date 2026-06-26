import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { AppTabBar } from '@/components/navigation/app-tab-bar';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.light.background },
        }}
      />
      <AppTabBar />
    </View>
  );
}
