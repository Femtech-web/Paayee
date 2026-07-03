import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { FooterButton } from '@/features/send/flows/shared/send-ui';
import { sendStyles as styles } from '@/features/send/send-screen.styles';

export function OperationSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    asset?: string;
    kind?: string;
    receiptId?: string;
    title?: string;
    transactionId?: string;
  }>();
  const transactionId = readParam(params.transactionId);
  const receiptId = readParam(params.receiptId);
  const kind = readParam(params.kind) ?? 'deposit';
  const title = readParam(params.title) ?? 'Your money is on its way';
  const amount = readParam(params.amount);
  const asset = readParam(params.asset) ?? 'NGN';
  const receiptHref = transactionId
    ? (`/transaction/${encodeURIComponent(transactionId)}?kind=${encodeURIComponent(kind)}${
        receiptId ? `&receiptId=${encodeURIComponent(receiptId)}` : ''
      }&returnTo=home` as Href)
    : undefined;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.successBody}>
          <FadeInView style={styles.successArt}>
            <View style={[styles.successRibbon, styles.successRibbonOne]} />
            <View style={[styles.successRibbon, styles.successRibbonTwo]} />
            <View style={[styles.successRibbon, styles.successRibbonThree]} />
            <View style={styles.successMark}>
              <Feather name="check" size={52} color={Colors.light.primary} />
            </View>
          </FadeInView>
          <FadeInView delay={80}>
            <Text style={styles.successTitle}>{title}</Text>
          </FadeInView>
          {amount ? (
            <FadeInView delay={120}>
              <Text style={styles.successText}>
                {amount} is being added to your {asset} balance. Your receipt is ready while we finish confirmation.
              </Text>
            </FadeInView>
          ) : null}
        </View>

        <View style={styles.successFooter}>
          <FooterButton label="Okay, got it" onPress={() => router.replace('/' as Href)} />
          {receiptHref ? (
            <PressableScale onPress={() => router.push(receiptHref)} style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>View receipt</Text>
            </PressableScale>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
