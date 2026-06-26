import { Feather } from '@react-native-vector-icons/feather';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

type EmptyTabScreenProps = {
  eyebrow: string;
  title: string;
  body: string;
  icon: 'users' | 'trending-up' | 'user';
};

export function EmptyTabScreen({ eyebrow, title, body, icon }: EmptyTabScreenProps) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.content}>
          <FadeInView style={styles.panel}>
            <View style={styles.iconWrap}>
              <Feather name={icon} size={24} color={Colors.light.primary} />
            </View>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </FadeInView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: 120,
  },
  panel: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 34,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.railSoft,
  },
  eyebrow: {
    marginTop: 18,
    color: Colors.light.textTertiary,
    fontFamily: Fonts.demi,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 10,
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 26,
    textAlign: 'center',
  },
  body: {
    maxWidth: 300,
    marginTop: 8,
    color: Colors.light.textSecondary,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
