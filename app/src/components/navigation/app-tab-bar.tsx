import { Feather } from '@react-native-vector-icons/feather';
import { GlassView } from 'expo-glass-effect';
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
      <View style={styles.rim}>
        <GlassView
          colorScheme="light"
          glassEffectStyle="clear"
          tintColor="rgba(255, 255, 255, 0.42)"
          style={styles.bar}>
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
                    color={active ? Colors.light.primary : '#191714'}
                  />
                  <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </GlassView>
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
  rim: {
    width: '92%',
    maxWidth: 420,
    minWidth: 300,
    height: 68,
    borderRadius: 34,
    padding: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(222, 216, 206, 0.68)',
    shadowColor: Colors.light.black,
    shadowOpacity: 0.12,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 5,
  },
  bar: {
    flex: 1,
    borderRadius: 33,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  itemSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  item: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  itemActive: {
    backgroundColor: 'rgba(233, 231, 227, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.56)',
  },
  label: {
    color: '#191714',
    fontFamily: Fonts.medium,
    fontSize: 11,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.light.primary,
    fontFamily: Fonts.demi,
  },
});
