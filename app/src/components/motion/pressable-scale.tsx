import { PropsWithChildren, useState } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type PressableScaleProps = PropsWithChildren<
  PressableProps & {
    scaleTo?: number;
    style?: StyleProp<ViewStyle>;
  }
>;

export function PressableScale({
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  style,
  ...props
}: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 18,
      stiffness: 320,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animateTo(scaleTo);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1);
    onPressOut?.(event);
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...props}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
