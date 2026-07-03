import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { runtimeConfig } from '@/config/runtime';
import { useAppData } from '@/features/app-data';
import { BalancePickerSheet } from '@/features/send/flows/shared/send-sheets';
import { AssetPill, FooterButton, SummaryRow } from '@/features/send/flows/shared/send-ui';
import {
  convertAmount,
  formatMoney,
  formatNumber,
  getTransferFee,
  readRateLabel,
} from '@/features/send/flows/shared/send-utils';
import { sendStyles as sendAmountStyles } from '@/features/send/send-screen.styles';
import {
  createSendAssetOptionsFromBalances,
  findSendAssetOption,
  type SendAssetCode,
  type SendAssetOption,
} from '@/features/send/send-data';
import type { KlydeQuote, MoneyAmount } from '@/integrations/klyde';

import { AddMoneyShell, TopBar } from '../components/add-money-shell';
import { StaticAssetPill } from '../components/add-money-ui';
import { addMoneyStyles as styles } from '../add-money-screen.styles';
import { createLiveConversion, executeLiveConversionQuote, quoteLiveConversion } from '../add-money-live';

export function AddMoneyConversionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const { data } = useAppData();
  const assets = useMemo(
    () => createSendAssetOptionsFromBalances(data?.balances),
    [data?.balances],
  );
  const targetAsset = findSendAssetOption(Array.isArray(params.asset) ? params.asset[0] : params.asset, assets);
  const [sourceAssetCode, setSourceAssetCode] = useState<SendAssetCode>(
    targetAsset.code === 'NGN' ? 'USDC' : 'NGN',
  );
  const sourceAsset = findSendAssetOption(sourceAssetCode, assets);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [quote, setQuote] = useState<KlydeQuote | undefined>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const numericAmount = Number(amount || 0);
  const fallbackFee = numericAmount > 0 ? getTransferFee(sourceAsset.code) : 0;
  const fallbackAmountAfterFee = Math.max(numericAmount - fallbackFee, 0);
  const fallbackReceiveAmount = convertAmount(fallbackAmountAfterFee, sourceAsset, targetAsset);
  const quotedReceiveAmount = quote?.settlementAmount
    ? moneyAmountToNumber(quote.settlementAmount)
    : fallbackReceiveAmount;
  const receiveAmount = runtimeConfig.realIntegrationsEnabled
    ? quote?.settlementAmount
      ? quotedReceiveAmount
      : 0
    : fallbackReceiveAmount;
  const receiveAmountLabel =
    runtimeConfig.realIntegrationsEnabled && numericAmount > 0 && !quote
      ? '...'
      : formatMoney(receiveAmount, targetAsset);
  const feeLabel = quote ? readQuoteFeeLabel(quote, sourceAsset) : `- ${formatMoney(fallbackFee, sourceAsset)}`;
  const rateLabel = quote
    ? readQuoteRateLabel(quote, sourceAsset, targetAsset)
    : readRateLabel(sourceAsset, targetAsset);
  const canSubmit =
    receiveAmount > 0 &&
    !submitting &&
    !quoteLoading &&
    (!runtimeConfig.realIntegrationsEnabled || Boolean(quote));

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 4500);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  useEffect(() => {
    setQuote(undefined);
    setQuoteError('');

    if (!runtimeConfig.realIntegrationsEnabled || numericAmount <= 0) {
      setQuoteLoading(false);
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      setQuoteLoading(true);

      quoteLiveConversion({
        amount: numericAmount,
        sourceAssetCode: sourceAsset.code,
        targetAssetCode: targetAsset.code,
      })
        .then((nextQuote) => {
          if (!active) {
            return;
          }

          if (!nextQuote?.settlementAmount) {
            setQuoteError('We could not get a conversion quote right now.');
            return;
          }

          setQuote(nextQuote);
        })
        .catch((quoteFailure) => {
          if (active) {
            setQuoteError(readConversionErrorMessage(quoteFailure, sourceAsset.code));
          }
        })
        .finally(() => {
          if (active) {
            setQuoteLoading(false);
          }
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [numericAmount, sourceAsset.code, targetAsset.code]);

  const overlay = <FeedbackToast message={errorMessage || quoteError} tone="error" />;

  return (
    <AddMoneyShell overlay={overlay}>
      <TopBar />
      <FadeInView delay={60} style={styles.heroCopy}>
        <Text style={styles.title}>Add money via conversion</Text>
        <Text style={styles.subtitle}>Enter amount and select the balance to convert from.</Text>
      </FadeInView>

      <FadeInView delay={120} style={{ gap: 20 }}>
        <Text style={sendAmountStyles.fieldLabel}>Amount to add</Text>
        <View style={sendAmountStyles.amountCard}>
          <View style={sendAmountStyles.amountTop}>
            <AssetPill asset={sourceAsset} onPress={() => setAssetPickerOpen(true)} />
            <TextInput
              value={amount ? formatMoney(numericAmount, sourceAsset) : ''}
              onChangeText={(value) => setAmount(value.replace(/\D/g, '').slice(0, 9))}
              keyboardType="number-pad"
              placeholder={`${sourceAsset.symbol}0`}
              placeholderTextColor="#B7BDC8"
              style={sendAmountStyles.amountInput}
            />
          </View>
          <Text style={sendAmountStyles.balanceHint}>
            Bal: {sourceAsset.symbol}
            {sourceAsset.balance}
          </Text>
        </View>

        <View style={sendAmountStyles.feeCard}>
          <SummaryRow label="Transaction fee" value={feeLabel} />
          <View style={sendAmountStyles.reviewDivider} />
          <SummaryRow
            label="Amount you will receive"
            value={quoteLoading ? 'Getting quote...' : `= ${receiveAmountLabel}`}
          />
          <SummaryRow label="Today's rate" value={quoteLoading ? 'Refreshing...' : rateLabel} />
        </View>

        <Text style={sendAmountStyles.fieldLabel}>Amount you will receive</Text>
        <View style={sendAmountStyles.receiveAmountCard}>
          <StaticAssetPill asset={targetAsset} />
          <Text style={sendAmountStyles.receiveAmount}>{receiveAmountLabel}</Text>
        </View>

        <View style={sendAmountStyles.arrivalHint}>
          <Feather name="zap" size={18} color="#A0A8B7" />
          <Text style={sendAmountStyles.arrivalHintText}>Usually arrives in a minute</Text>
        </View>
      </FadeInView>

      <FooterButton
        disabled={!canSubmit}
        label={submitting ? 'Converting...' : 'Continue'}
        onPress={async () => {
          setSubmitting(true);
          setErrorMessage('');

          try {
            const conversion = quote
              ? await executeLiveConversionQuote(quote.id)
              : await createLiveConversion({
                  amount: numericAmount,
                  sourceAssetCode: sourceAsset.code,
                  targetAssetCode: targetAsset.code,
                });

            if (conversion) {
              const targetAmount = conversion.targetAmount
                ? formatKlydeMoneyAmount(conversion.targetAmount, targetAsset)
                : formatMoney(receiveAmount, targetAsset);

              router.replace(
                `/operation-success?title=${encodeURIComponent('Conversion complete')}&amount=${encodeURIComponent(
                  targetAmount,
                )}&asset=${encodeURIComponent(targetAsset.code)}&kind=conversion&transactionId=${encodeURIComponent(
                  conversion.id,
                )}` as Href,
              );
              return;
            }

            router.replace(`/asset/${targetAsset.code.toLowerCase()}` as Href);
          } catch (conversionError) {
            setErrorMessage(readConversionErrorMessage(conversionError, sourceAsset.code));
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <BalancePickerSheet
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={(nextAsset) => {
          if (nextAsset.code !== targetAsset.code) {
            setSourceAssetCode(nextAsset.code);
          }
          setAssetPickerOpen(false);
        }}
        selectedAsset={sourceAsset}
        assets={assets}
      />
    </AddMoneyShell>
  );
}

function moneyAmountToNumber(amount: MoneyAmount): number {
  const minorUnits = Number(amount.minorUnits);

  if (Number.isFinite(minorUnits)) {
    return minorUnits / 10 ** (amount.scale ?? 0);
  }

  return Number(amount.display || 0);
}

function formatKlydeMoneyAmount(amount: MoneyAmount, asset: SendAssetOption): string {
  return formatMoney(moneyAmountToNumber(amount), asset);
}

function readQuoteFeeLabel(quote: KlydeQuote, sourceAsset: SendAssetOption): string {
  const totalFee = (quote.fees ?? []).reduce((sum, fee) => {
    if (fee.amount.currency !== sourceAsset.code) {
      return sum;
    }

    return sum + moneyAmountToNumber(fee.amount);
  }, 0);

  if (totalFee <= 0) {
    return 'Included';
  }

  return `- ${formatMoney(totalFee, sourceAsset)}`;
}

function readQuoteRateLabel(
  quote: KlydeQuote,
  sourceAsset: SendAssetOption,
  targetAsset: SendAssetOption,
): string {
  const sourceAmount = moneyAmountToNumber(quote.sourceAmount);
  const settlementAmount = quote.settlementAmount ? moneyAmountToNumber(quote.settlementAmount) : 0;

  if (sourceAmount <= 0 || settlementAmount <= 0) {
    return 'Live quote';
  }

  const rate = settlementAmount / sourceAmount;

  if (targetAsset.code === 'NGN') {
    return `1 ${sourceAsset.code} = ${targetAsset.symbol}${formatNumber(rate)}`;
  }

  return `1 ${sourceAsset.code} = ${targetAsset.symbol}${rate.toLocaleString('en-US', {
    maximumFractionDigits: 6,
  })}`;
}

function readConversionErrorMessage(error: unknown, sourceAssetCode: SendAssetCode): string {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('insufficient')) {
    return `You do not have enough ${sourceAssetCode} available to convert.`;
  }

  if (normalized.includes('expired')) {
    return 'This rate has expired. Refresh the quote and try again.';
  }

  if (normalized.includes('rate') || normalized.includes('provider')) {
    return 'We could not get a conversion rate right now. Please try again.';
  }

  if (normalized.includes('quote')) {
    return 'We could not confirm this quote. Please try again.';
  }

  return 'Could not complete this conversion. Please try again.';
}
