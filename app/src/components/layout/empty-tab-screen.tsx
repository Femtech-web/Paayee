import { Feather } from '@react-native-vector-icons/feather';
import { StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts } from '@/constants/theme';

type EmptyTabScreenProps = {
  eyebrow: string;
  action?: string;
  title: string;
  body: string;
  icon: 'users' | 'trending-up' | 'user';
};

export function EmptyTabScreen({ action = 'Coming soon', eyebrow, title, body, icon }: EmptyTabScreenProps) {
  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <FadeInView style={styles.panel}>
        <View style={styles.iconWrap}>
          <Feather name={icon} size={24} color={Colors.light.primary} />
        </View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <PrimaryButton label={action} variant="soft" />
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
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
    marginTop: 8,
    color: Colors.light.textTertiary,
    fontFamily: Fonts.demi,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 26,
    textAlign: 'center',
  },
  body: {
    maxWidth: 300,
    marginBottom: 12,
    color: Colors.light.textSecondary,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
