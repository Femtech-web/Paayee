import { PropsWithChildren, useEffect, useState } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

type SkeletonBlockProps = {
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({ style }: SkeletonBlockProps) {
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 680,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 680,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

type SkeletonSurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function SkeletonSurface({ children, style }: SkeletonSurfaceProps) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function HomeBalanceSkeleton() {
  return (
    <View style={styles.homeBalance}>
      <SkeletonBlock style={styles.pill} />
      <SkeletonBlock style={styles.amount} />
      <View style={styles.actions}>
        <SkeletonBlock style={styles.action} />
        <SkeletonBlock style={styles.action} />
        <SkeletonBlock style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundElement,
  },
  surface: {
    borderRadius: 28,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  homeBalance: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 16,
  },
  pill: {
    width: 124,
    height: 34,
    borderRadius: 17,
  },
  amount: {
    width: 214,
    height: 52,
    borderRadius: 18,
  },
  actions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 42,
  },
  action: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
});
