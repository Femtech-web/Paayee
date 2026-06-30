import { Feather } from '@react-native-vector-icons/feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { transferPurposes, type SendAssetCode } from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import { ScreenShell, TopBar } from './send-layout';
import { FieldLabel, FooterButton, RecipientHeader, SummaryRow } from './send-ui';
import { findAsset, formatMoney, readParam } from './send-utils';
import { useRecipientParams } from './use-recipient-params';

export function ReviewSendScreen() {
  const router = useRouter();
  const recipient = useRecipientParams();
  const params = useLocalSearchParams<{ amount?: string; asset?: SendAssetCode; fee?: string }>();
  const amount = Number(params.amount ?? 5000);
  const fee = Number(params.fee ?? 35);
  const asset = findAsset(readParam(params.asset) as SendAssetCode | undefined);
  const [purpose, setPurpose] = useState<(typeof transferPurposes)[number]>('General');
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [narration, setNarration] = useState('');

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
      </FadeInView>

      <FooterButton label="Send money" onPress={() => router.replace('/send/success')} />
    </ScreenShell>
  );
}
