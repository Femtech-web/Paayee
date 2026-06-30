import { Feather } from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { sendStyles as styles } from '../../send-screen.styles';
import { FooterButton } from './send-ui';

export function SendSuccessScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.successBody}>
          <FadeInView style={styles.successArt}>
            <View style={[styles.successRibbon, styles.successRibbonOne]} />
            <View style={[styles.successRibbon, styles.successRibbonTwo]} />
            <View style={[styles.successRibbon, styles.successRibbonThree]} />
            <View style={styles.successMark}>
              <Feather name="send" size={48} color={Colors.light.primary} />
            </View>
          </FadeInView>
          <FadeInView delay={80}>
            <Text style={styles.successTitle}>Your money is on its way</Text>
          </FadeInView>
          <FadeInView delay={120}>
            <Text style={styles.successText}>
              We will notify you when the transfer is confirmed.
            </Text>
          </FadeInView>
        </View>

        <View style={styles.successFooter}>
          <FooterButton label="Okay, got it" onPress={() => router.replace('/')} />
          <PressableScale style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>Download receipt</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}
