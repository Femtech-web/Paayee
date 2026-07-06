import { Feather } from '@react-native-vector-icons/feather';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import {
  stablecoinNetworks,
  transferPurposes,
  type SendAssetCode,
} from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import { createLiveSend, isPrivateSendResult, type LiveSendMethod } from '../../send-live';
import { ScreenShell, TopBar } from './send-layout';
import { FieldLabel, FooterButton, RecipientHeader, SummaryRow } from './send-ui';
import { findAsset, formatMoney, readParam } from './send-utils';
import { useRecipientParams } from './use-recipient-params';

export function ReviewSendScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const recipient = useRecipientParams();
  const params = useLocalSearchParams<{
    amount?: string;
    asset?: SendAssetCode;
    fee?: string;
    networkId?: string;
  }>();
  const amount = Number(params.amount ?? 5000);
  const fee = Number(params.fee ?? 35);
  const asset = findAsset(readParam(params.asset) as SendAssetCode | undefined);
  const network = stablecoinNetworks.find((item) => item.id === readParam(params.networkId));
  const [purpose, setPurpose] = useState<(typeof transferPurposes)[number]>('General');
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [narration, setNarration] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const method = readSendMethod(pathname);

  const sendMoney = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const liveSend = await createLiveSend({
        amount,
        assetCode: asset.code,
        method,
        narration,
        network,
        purpose,
        recipient,
      });

      if (liveSend) {
        if (isPrivateSendResult(liveSend)) {
          router.replace(
            `/operation-success?title=${encodeURIComponent('Private transfer prepared')}&asset=${encodeURIComponent(
              asset.code,
            )}&amount=${encodeURIComponent(formatMoney(amount, asset))}&kind=private-send&transactionId=${encodeURIComponent(
              liveSend.operation.id,
            )}&privateEnvelopeId=${encodeURIComponent(liveSend.envelope.id)}&status=${encodeURIComponent(
              liveSend.operation.status,
            )}` as const,
          );
          return;
        }

        const transactionId = liveSend.receiptId ?? liveSend.id;
        const receiptQuery = liveSend.receiptId
          ? `&receiptId=${encodeURIComponent(liveSend.receiptId)}`
          : '';

        router.replace(
          `/operation-success?title=${encodeURIComponent('Transfer started')}&amount=${encodeURIComponent(
            formatMoney(amount, asset),
          )}&asset=${encodeURIComponent(asset.code)}&kind=send&transactionId=${encodeURIComponent(
            transactionId,
          )}${receiptQuery}` as const,
        );
        return;
      }

      router.replace('/send/success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not complete this transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell>
      <TopBar centeredTitle="Review transfer" />
      <FadeInView delay={70} style={styles.reviewPanel}>
        <RecipientHeader recipient={recipient} />
        <View style={styles.reviewDivider} />
        <SummaryRow label="Amount tendered" value={formatMoney(amount + fee, asset)} />
        <SummaryRow label="Total fees" value={formatMoney(fee, asset)} />
        <SummaryRow label="Recipient will receive" value={formatMoney(amount, asset)} />
        <View style={styles.reviewDivider} />
      </FadeInView>

      <FadeInView delay={120} style={styles.form}>
        <FieldLabel label="What is this for?">
          <Pressable onPress={() => setPurposeOpen((open) => !open)} style={styles.field}>
            <Text style={styles.fieldText}>{purpose}</Text>
            <Feather name="chevron-down" size={20} color="#3F4653" />
          </Pressable>
        </FieldLabel>

        {purposeOpen ? (
          <View style={styles.optionPanel}>
            {transferPurposes.map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setPurpose(item);
                  setPurposeOpen(false);
                }}
                style={styles.optionRow}>
                <Text style={styles.optionText}>{item}</Text>
                {purpose === item ? (
                  <Feather name="check" size={18} color="#F47B20" />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <FieldLabel label="Narration">
          <TextInput
            value={narration}
            onChangeText={setNarration}
            placeholder="Optional note"
            placeholderTextColor="#B7BDC8"
            style={styles.inputBox}
          />
        </FieldLabel>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </FadeInView>

      <FooterButton
        disabled={submitting}
        label={submitting ? 'Sending...' : 'Send money'}
        onPress={sendMoney}
      />
    </ScreenShell>
  );
}

function readSendMethod(pathname: string): LiveSendMethod {
  if (pathname.includes('/stablecoin/')) {
    return 'stablecoin';
  }

  if (pathname.includes('/handle/')) {
    return 'handle';
  }

  return 'bank';
}
