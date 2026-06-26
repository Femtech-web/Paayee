import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

const markSource = require('../../../assets/brand/paayee-splash-mark.png');
const wordmarkSource = require('../../../assets/brand/paayee-wordmark.png');

type AnimatedSplashScreenProps = {
  onFinish: () => void;
};

export function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [markScale] = useState(() => new Animated.Value(0.9));
  const [wordOpacity] = useState(() => new Animated.Value(0));
  const [wordOffset] = useState(() => new Animated.Value(8));

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(markScale, {
          toValue: 1,
          damping: 18,
          stiffness: 145,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(wordOffset, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(420),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(wordOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });

    return () => animation.stop();
  }, [markScale, onFinish, opacity, wordOffset, wordOpacity]);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.brandWrap, { opacity }]}>
        <Animated.Image
          source={markSource}
          resizeMode="contain"
          style={[styles.mark, { transform: [{ scale: markScale }] }]}
        />
        <Animated.Image
          source={wordmarkSource}
          resizeMode="contain"
          style={[styles.wordmark, { opacity: wordOpacity, transform: [{ translateY: wordOffset }] }]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  brandWrap: {
    width: 220,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 92,
    height: 92,
  },
  wordmark: {
    position: 'absolute',
    bottom: 28,
    width: 118,
    height: 30,
  },
});
