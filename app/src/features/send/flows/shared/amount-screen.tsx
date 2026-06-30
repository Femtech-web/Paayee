import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import {
  sendAssetOptions,
  type SendAssetCode,
  type SendAssetOption,
  type SendRecipient,
} from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import { ScreenShell, TopBar } from './send-layout';
import { BalancePickerSheet } from './send-sheets';
import { AssetPill, FooterButton, RecipientHeader, SummaryRow } from './send-ui';
import {
  convertAmount,
  formatMoney,
  getTransferFee,
  readRateLabel,
} from './send-utils';
import { useRecipientParams } from './use-recipient-params';

type SharedAmountScreenProps = {
  allowedAssetCodes?: SendAssetCode[];
  arrivalText?: string;
  defaultSendAsset: SendAssetOption;
  defaultTenderedAmount?: string;
  fallbackRecipient: SendRecipient;
  reviewPath: '/send/bank/review' | '/send/handle/review' | '/send/stablecoin/review';
  title?: string | ((asset: SendAssetOption, recipient: SendRecipient & { firstName: string }) => string);
};

export function SharedAmountScreen({
  allowedAssetCodes,
  arrivalText = 'Usually arrives in a few seconds',
  defaultSendAsset,
  defaultTenderedAmount = '',
  fallbackRecipient,
  reviewPath,
  title,
}: SharedAmountScreenProps) {
  const router = useRouter();
  const recipient = useRecipientParams(fallbackRecipient);
  const [sendAsset, setSendAsset] = useState<SendAssetOption>(defaultSendAsset);
  const [receiveAsset, setReceiveAsset] = useState<SendAssetOption>(defaultSendAsset);
  const [activeAssetPicker, setActiveAssetPicker] = useState<'receive' | 'send' | null>(null);
  const [tenderedAmount, setTenderedAmount] = useState(defaultTenderedAmount);
  const numericTendered = Number(tenderedAmount || 0);
  const fee = numericTendered > 0 ? getTransferFee(sendAsset.code) : 0;
  const recipientAmount = Math.max(numericTendered - fee, 0);
  const sameAsset = sendAsset.code === receiveAsset.code;
  const receiveAmount = sameAsset ? recipientAmount : convertAmount(recipientAmount, sendAsset, receiveAsset);
  const centeredTitle =
    typeof title === 'function'
      ? title(sendAsset, recipient)
      : title ?? `Send ${sendAsset.code} to ${recipient.firstName}`;

  return (
    <ScreenShell>
      <TopBar centeredTitle={centeredTitle} />
      <FadeInView delay={60}>
        <RecipientHeader recipient={recipient} />
      </FadeInView>

      <FadeInView delay={120} style={styles.form}>
        <Text style={styles.fieldLabel}>Amount to send</Text>
        <View style={styles.amountCard}>
          <View style={styles.amountTop}>
            <AssetPill asset={sendAsset} onPress={() => setActiveAssetPicker('send')} />
            <TextInput
              value={tenderedAmount ? formatMoney(numericTendered, sendAsset) : ''}
              onChangeText={(value) => setTenderedAmount(value.replace(/\D/g, '').slice(0, 9))}
              keyboardType="number-pad"
              placeholder={`${sendAsset.symbol}0`}
              placeholderTextColor="#B7BDC8"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.balanceHint}>
            Bal: {sendAsset.symbol}
            {sendAsset.balance}
          </Text>
        </View>

        <View style={styles.feeCard}>
          <SummaryRow label="Total fees" value={`- ${formatMoney(fee, sendAsset)}`} />
          <View style={styles.reviewDivider} />
          <SummaryRow
            label="Amount we'll send"
            value={`= ${formatMoney(recipientAmount, sendAsset)}`}
          />
          {!sameAsset ? (
            <SummaryRow label="Today's rate" value={readRateLabel(sendAsset, receiveAsset)} />
          ) : null}
        </View>

        <Text style={styles.fieldLabel}>Recipient will receive</Text>
        <View style={styles.receiveAmountCard}>
          <AssetPill asset={receiveAsset} onPress={() => setActiveAssetPicker('receive')} />
          <Text style={styles.receiveAmount}>{formatMoney(receiveAmount, receiveAsset)}</Text>
        </View>

        <View style={styles.arrivalHint}>
          <Feather name="zap" size={18} color="#A0A8B7" />
          <Text style={styles.arrivalHintText}>{arrivalText}</Text>
        </View>
      </FadeInView>

      <FooterButton
        disabled={recipientAmount <= 0}
        label="Continue"
        onPress={() =>
          router.push(
            `${reviewPath}?name=${encodeURIComponent(recipient.name)}&bank=${encodeURIComponent(
              recipient.bankName,
            )}&account=${encodeURIComponent(recipient.accountNumber)}&initials=${
              recipient.initials
            }&amount=${receiveAmount}&fee=${fee}&asset=${receiveAsset.code}` as Href,
          )
        }
      />
      <BalancePickerSheet
        open={activeAssetPicker !== null}
        onClose={() => setActiveAssetPicker(null)}
        onSelect={(asset) => {
          if (activeAssetPicker === 'send') {
            setSendAsset(asset);
            setReceiveAsset(asset);
          } else if (activeAssetPicker === 'receive') {
            setReceiveAsset(asset);
          }
          setActiveAssetPicker(null);
        }}
        selectedAsset={activeAssetPicker === 'receive' ? receiveAsset : sendAsset}
        allowedCodes={allowedAssetCodes}
      />
    </ScreenShell>
  );
}

export const defaultNgnAsset = sendAssetOptions[0];
export const defaultStableAsset = sendAssetOptions[1];
