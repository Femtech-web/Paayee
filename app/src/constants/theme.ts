/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#171513',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F5F2',
    backgroundElement: '#F7F6F3',
    backgroundSelected: '#FFF5DE',
    textSecondary: '#6F6B63',
    textTertiary: '#A29B90',
    border: '#ECE8DF',
    primary: '#F47B20',
    primaryPressed: '#D86113',
    primarySoft: '#FFE3C8',
    rail: '#FFD55A',
    railSoft: '#FFF5DE',
    tertiary: '#171513',
    tertiarySoft: '#F7F6F3',
    white: '#FFFFFF',
    black: '#171513',
    error: '#C94A3D',
    success: '#168A55',
  },
  dark: {
    text: '#171513',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F5F2',
    backgroundElement: '#F7F6F3',
    backgroundSelected: '#FFF5DE',
    textSecondary: '#6F6B63',
    textTertiary: '#A29B90',
    border: '#ECE8DF',
    primary: '#F47B20',
    primaryPressed: '#D86113',
    primarySoft: '#FFE3C8',
    rail: '#FFD55A',
    railSoft: '#FFF5DE',
    tertiary: '#171513',
    tertiarySoft: '#F7F6F3',
    white: '#FFFFFF',
    black: '#171513',
    error: '#C94A3D',
    success: '#168A55',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'AvenirNext-Regular',
    serif: 'AvenirNext-Regular',
    rounded: 'AvenirNext-Regular',
    medium: 'AvenirNext-Medium',
    demi: 'AvenirNext-DemiBold',
    bold: 'AvenirNext-Bold',
    mono: 'Menlo',
  },
  default: {
    sans: 'Avenir Next',
    serif: 'serif',
    rounded: 'Avenir Next',
    medium: 'Avenir Next',
    demi: 'Avenir Next',
    bold: 'Avenir Next',
    mono: 'monospace',
  },
  web: {
    sans: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    serif: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    rounded: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    medium: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    demi: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    bold: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 460;
