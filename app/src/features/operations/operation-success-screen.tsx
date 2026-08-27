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
import { getPaayeeWalletAddress } from '@/features/confidential/zama-mobile-runtime';
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
  const asset = readParam(params.asset) ?? inferAsset(title, amount);
  const [privateEnvelope, setPrivateEnvelope] = useState<PaayeePrivateOperationEnvelope>();

  useEffect(() => {
    if (!privateEnvelopeId) {
      return;
    }

    void getPaayeeWalletAddress()
      .then((ownerAddress) => getPaayeePrivateOperationEnvelope(privateEnvelopeId, ownerAddress))
      .then(setPrivateEnvelope)
      .catch(() => setPrivateEnvelope(undefined));
  }, [privateEnvelopeId]);

  const receiptHref = transactionId
    ? (`/transaction/${encodeURIComponent(transactionId)}?kind=${encodeURIComponent(kind)}${
        receiptId ? `&receiptId=${encodeURIComponent(receiptId)}` : ''
      }${privateEnvelopeId ? `&privateEnvelopeId=${encodeURIComponent(privateEnvelopeId)}` : ''}&returnTo=home` as Href)
    : undefined;
  const detailText = createDetailText({ amount, asset, kind, privateEnvelope, status });
  const canMakePrivate = kind === 'deposit' && (asset === 'USDC' || asset === 'USDT');

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
          <FooterButton
            label={canMakePrivate ? 'Make private' : 'Okay, got it'}
            onPress={() => {
              if (canMakePrivate) {
                router.replace(`/asset/${asset.toLowerCase()}?action=shield` as Href);
                return;
              }
              router.replace('/' as Href);
            }}
          />
          {canMakePrivate ? (
            <PressableScale onPress={() => router.replace('/' as Href)} style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Keep Spendable</Text>
            </PressableScale>
          ) : receiptHref ? (
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
    const recipientText = privateEnvelope?.recipientHandle
      ? ` to @${privateEnvelope.recipientHandle.replace(/^@+/, '')}`
      : '';

    if (status === 'succeeded') {
      return `${amountText ?? 'Your transfer'} was sent privately${recipientText}.`;
    }

    const statusText = status ? ` Status: ${formatStatus(status)}.` : '';

    return `${amountText ? `${amountText} ` : ''}was submitted as a private transfer${recipientText}.${statusText}`;
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

  if (kind === 'private-receive') {
    return `A private ${asset} transfer was confirmed. Open the receipt whenever you want to reveal its amount.`;
  }

  if (!amount) {
    return undefined;
  }

  if (kind === 'send') {
    return `${amount} was submitted. Your receipt will show the final confirmation status.`;
  }

  if (kind === 'conversion') {
    return `${amount} has been converted. Your receipt is ready while we finish confirmation.`;
  }

  if (kind === 'deposit') {
    return `${amount} was received in your public ${asset} balance.`;
  }

  return `${amount} was added to your ${asset} balance.`;
}

function inferAsset(title: string, amount?: string): string {
  const text = `${title} ${amount ?? ''}`.toUpperCase();
  if (text.includes('USDC')) return 'USDC';
  if (text.includes('USDT')) return 'USDT';
  return 'NGN';
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
