import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { useAppData } from '@/features/app-data';
import {
  createSendAssetOptionsFromBalances,
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
  readParam,
} from './send-utils';
import { useRecipientParams } from './use-recipient-params';

type SharedAmountScreenProps = {
  allowedAssetCodes?: SendAssetCode[];
  arrivalText?: string;
  defaultSendAsset: SendAssetOption;
  defaultTenderedAmount?: string;
  fallbackRecipient: SendRecipient;
  lockReceiveAsset?: boolean;
  reviewPath: '/send/bank/review' | '/send/handle/review' | '/send/stablecoin/review';
  title?: string | ((asset: SendAssetOption, recipient: SendRecipient & { firstName: string }) => string);
};

export function SharedAmountScreen({
  allowedAssetCodes,
  arrivalText = 'Usually arrives in a few seconds',
  defaultSendAsset,
  defaultTenderedAmount = '',
  fallbackRecipient,
  lockReceiveAsset = false,
  reviewPath,
  title,
}: SharedAmountScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ networkId?: string }>();
  const recipient = useRecipientParams(fallbackRecipient);
  const { data } = useAppData();
  const liveAssets = useMemo(
    () => createSendAssetOptionsFromBalances(data?.balances),
    [data?.balances],
  );
  const [sendAssetCode, setSendAssetCode] = useState<SendAssetCode>(defaultSendAsset.code);
  const [receiveAssetCode, setReceiveAssetCode] = useState<SendAssetCode>(defaultSendAsset.code);
  const [activeAssetPicker, setActiveAssetPicker] = useState<'receive' | 'send' | null>(null);
  const [tenderedAmount, setTenderedAmount] = useState(defaultTenderedAmount);
  const sendAsset =
    liveAssets.find((asset) => asset.code === sendAssetCode) ?? defaultSendAsset;
  const receiveAsset =
    liveAssets.find((asset) => asset.code === receiveAssetCode) ?? sendAsset;
  const numericTendered = parseAmountInput(tenderedAmount);
  const fee = numericTendered > 0 ? getTransferFee(sendAsset.code) : 0;
  const recipientAmount = Math.max(numericTendered - fee, 0);
  const sameAsset = sendAsset.code === receiveAsset.code;
  const receiveAmount = sameAsset ? recipientAmount : convertAmount(recipientAmount, sendAsset, receiveAsset);
  const numericBalance = parseAssetBalance(sendAsset.balance);
  const remainingBalance = Math.max(numericBalance - numericTendered, 0);
  const balanceUnavailable = Boolean(sendAsset.balanceUnavailable);
  const balanceExceeded = balanceUnavailable ? numericTendered > 0 : numericTendered > numericBalance;
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
              value={tenderedAmount ? formatEditableAmount(tenderedAmount, sendAsset) : ''}
              onChangeText={(value) => setTenderedAmount(sanitizeAmountInput(value))}
              keyboardType="decimal-pad"
              placeholder={`${sendAsset.symbol}0`}
              placeholderTextColor="#B7BDC8"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.balanceHint}>
            Bal: {balanceUnavailable ? `${sendAsset.symbol}••••` : formatMoney(numericTendered > 0 ? remainingBalance : numericBalance, sendAsset)}
          </Text>
        </View>
        {balanceExceeded ? (
          <Text style={styles.errorText}>
            {balanceUnavailable
              ? `Decrypt your private ${sendAsset.code} balance before sending from it.`
              : `This amount is higher than your available ${sendAsset.code} balance.`}
          </Text>
        ) : null}

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
          <AssetPill
            asset={receiveAsset}
            onPress={lockReceiveAsset ? undefined : () => setActiveAssetPicker('receive')}
          />
          <Text style={styles.receiveAmount}>{formatMoney(receiveAmount, receiveAsset)}</Text>
        </View>

        <View style={styles.arrivalHint}>
          <Feather name="zap" size={18} color="#A0A8B7" />
          <Text style={styles.arrivalHintText}>{arrivalText}</Text>
        </View>
      </FadeInView>

      <FooterButton
        disabled={recipientAmount <= 0 || balanceExceeded}
        label="Continue"
        onPress={() => {
          const walletQuery = recipient.walletAddress
            ? `&wallet=${encodeURIComponent(recipient.walletAddress)}`
            : '';
          const bankCodeQuery = recipient.bankCode
            ? `&bankCode=${encodeURIComponent(recipient.bankCode)}`
            : '';
          const networkId = readParam(params.networkId);
          const networkQuery = networkId ? `&networkId=${encodeURIComponent(networkId)}` : '';

          router.push(
            `${reviewPath}?name=${encodeURIComponent(recipient.name)}&bank=${encodeURIComponent(
              recipient.bankName,
            )}&account=${encodeURIComponent(recipient.accountNumber)}&initials=${
              recipient.initials
            }&amount=${receiveAmount}&fee=${fee}&asset=${receiveAsset.code}${walletQuery}${bankCodeQuery}${networkQuery}` as Href,
          );
        }}
      />
      <BalancePickerSheet
        open={activeAssetPicker !== null}
        onClose={() => setActiveAssetPicker(null)}
        onSelect={(asset) => {
          if (activeAssetPicker === 'send') {
            setSendAssetCode(asset.code);
            setReceiveAssetCode(asset.code);
          } else if (activeAssetPicker === 'receive' && !lockReceiveAsset) {
            setReceiveAssetCode(asset.code);
          }
          setActiveAssetPicker(null);
        }}
        selectedAsset={activeAssetPicker === 'receive' ? receiveAsset : sendAsset}
        allowedCodes={allowedAssetCodes}
        assets={liveAssets}
      />
    </ScreenShell>
  );
}

export const defaultNgnAsset = sendAssetOptions[0];
export const defaultStableAsset = sendAssetOptions[1];

function sanitizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  const [rawInteger = '', ...decimalParts] = normalized.split('.');
  const integer = rawInteger.replace(/^0+(?=\d)/, '').slice(0, 9);
  const decimals = decimalParts.join('').slice(0, 2);

  if (normalized.includes('.')) {
    return `${integer || '0'}.${decimals}`;
  }

  return integer;
}

function parseAmountInput(value: string) {
  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function parseAssetBalance(value: string) {
  const amount = Number(value.replace(/[^\d.-]/g, ''));

  return Number.isFinite(amount) ? amount : 0;
}

function formatEditableAmount(value: string, asset: SendAssetOption) {
  const [integerPart = '0', decimalPart] = value.split('.');
  const integer = Number(integerPart || 0);
  const formattedInteger = new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(integer) ? integer : 0);

  return `${asset.symbol}${formattedInteger}${decimalPart !== undefined ? `.${decimalPart}` : ''}`;
}
