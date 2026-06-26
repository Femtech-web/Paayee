import { Feather } from '@react-native-vector-icons/feather';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
            <View key={tab.href} style={styles.itemSlot}>
              <Pressable
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
              </Pressable>
            </View>
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
    width: '92%',
    maxWidth: 420,
    minWidth: 300,
    height: 76,
    borderRadius: 38,
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
  itemSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  item: {
    width: '100%',
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  itemActive: {
    backgroundColor: '#2B251F',
  },
  label: {
    color: '#9D958A',
    fontFamily: Fonts.medium,
    fontSize: 10.5,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.light.primary,
    fontFamily: Fonts.demi,
  },
});
