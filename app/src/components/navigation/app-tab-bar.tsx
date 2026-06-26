import { Feather } from '@react-native-vector-icons/feather';
import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors, Fonts } from '@/constants/theme';

const tabs = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/people', label: 'People', icon: 'users' },
  { href: '/transactions', label: 'Transactions', icon: 'trending-up' },
  { href: '/profile', label: 'Profile', icon: 'user' },
] as const;

export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <PressableScale
              key={tab.href}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => router.push(tab.href)}
              style={[styles.item, active && styles.itemActive]}>
              <Feather
                name={tab.icon}
                size={19}
                color={active ? Colors.light.primary : '#9D958A'}
              />
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
  },
  bar: {
    width: '88%',
    maxWidth: 390,
    minWidth: 300,
    height: 72,
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: '#181511',
    borderWidth: 1,
    borderColor: '#2A251F',
    shadowColor: Colors.light.black,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  item: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  itemActive: {
    backgroundColor: '#2A251F',
  },
  label: {
    color: '#9D958A',
    fontFamily: Fonts.medium,
    fontSize: 10,
  },
  labelActive: {
    color: Colors.light.primary,
    fontFamily: Fonts.demi,
  },
});
