import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import {
  getPaayeePrivateOperationEnvelope,
  type PaayeePrivateOperationEnvelope,
} from '@/features/confidential/confidential-money';
import { FooterButton } from '@/features/send/flows/shared/send-ui';
import { sendStyles as styles } from '@/features/send/send-screen.styles';

export function OperationSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    asset?: string;
    kind?: string;
    receiptId?: string;
    privateEnvelopeId?: string;
    status?: string;
    title?: string;
    transactionId?: string;
  }>();
  const transactionId = readParam(params.transactionId);
  const receiptId = readParam(params.receiptId);
  const privateEnvelopeId = readParam(params.privateEnvelopeId);
  const status = readParam(params.status);
  const kind = readParam(params.kind) ?? 'deposit';
  const title = readParam(params.title) ?? 'Your money is on its way';
  const amount = readParam(params.amount);
  const asset = readParam(params.asset) ?? 'NGN';
  const [privateEnvelope, setPrivateEnvelope] = useState<PaayeePrivateOperationEnvelope>();

  useEffect(() => {
    if (!privateEnvelopeId) {
      return;
    }

    void getPaayeePrivateOperationEnvelope(privateEnvelopeId).then(setPrivateEnvelope);
  }, [privateEnvelopeId]);

  const receiptHref = transactionId
    ? (`/transaction/${encodeURIComponent(transactionId)}?kind=${encodeURIComponent(kind)}${
        receiptId ? `&receiptId=${encodeURIComponent(receiptId)}` : ''
      }${privateEnvelopeId ? `&privateEnvelopeId=${encodeURIComponent(privateEnvelopeId)}` : ''}&returnTo=home` as Href)
    : undefined;
  const detailText = createDetailText({ amount, asset, kind, privateEnvelope, status });

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
          {detailText ? (
            <FadeInView delay={120}>
              <Text style={styles.successText}>{detailText}</Text>
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

function createDetailText({
  amount,
  asset,
  kind,
  privateEnvelope,
  status,
}: {
  amount?: string;
  asset: string;
  kind: string;
  privateEnvelope?: PaayeePrivateOperationEnvelope;
  status?: string;
}) {
  if (kind === 'private-send') {
    const amountText = privateEnvelope?.amountDisplay ?? amount;
    const statusText = status ? ` Status: ${formatStatus(status)}.` : '';

    return `${amountText ? `${amountText} ` : ''}is prepared as a private Paayee confidential-token operation.${statusText}`;
  }

  if (kind === 'private-conversion') {
    const sourceText = privateEnvelope?.sourceAmountDisplay;
    const targetText = privateEnvelope?.targetAmountDisplay ?? amount;
    const statusText = status ? ` Status: ${formatStatus(status)}.` : '';

    if (sourceText && targetText) {
      return `${sourceText} to ${targetText} is prepared as a private Paayee confidential-token conversion.${statusText}`;
    }

    return `This conversion is prepared as a private Paayee confidential-token operation.${statusText}`;
  }

  if (kind === 'private-funding') {
    const amountText = amount ? `${amount} ` : '';

    return `${amountText}has been verified by Klyde and is moving into your private Paayee balance.`;
  }

  if (!amount) {
    return undefined;
  }

  if (kind === 'send') {
    return `${amount} is on its way. Your receipt is ready while we finish confirmation.`;
  }

  if (kind === 'conversion') {
    return `${amount} has been converted. Your receipt is ready while we finish confirmation.`;
  }

  return `${amount} is being added to your ${asset} balance. Your receipt is ready while we finish confirmation.`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
