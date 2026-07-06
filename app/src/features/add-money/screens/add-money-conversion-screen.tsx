import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { runtimeConfig } from '@/config/runtime';
import { useAppData } from '@/features/app-data';
import {
  getPaayeeConfidentialBalanceDisplay,
  isStablecoinAsset,
  type StablecoinAssetCode,
} from '@/features/confidential/confidential-money';
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
import { getKlydeConfig } from '@/integrations/klyde/env';

import { AddMoneyShell, TopBar } from '../components/add-money-shell';
import { StaticAssetPill } from '../components/add-money-ui';
import { addMoneyStyles as styles } from '../add-money-screen.styles';
import {
  createLiveConversion,
  executeLiveConversionQuote,
  executeLivePrivateStablecoinConversion,
  isNgnToPrivateStablecoinConversion,
  isPrivateStablecoinConversion,
  isPrivateStablecoinToNgnConversion,
  prepareLivePrivateConversionSettlement,
  quoteLiveConversion,
} from '../add-money-live';

type DecryptedConversionBalance = {
  balance: string;
  displayAmount: string;
};

export function AddMoneyConversionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const { data } = useAppData();
  const assets = useMemo(
    () => createSendAssetOptionsFromBalances(data?.balances),
    [data?.balances],
  );
  const targetAsset = findSendAssetOption(Array.isArray(params.asset) ? params.asset[0] : params.asset, assets);
  const sourceAssetOptionsBase = useMemo(
    () => assets.filter((asset) => asset.code !== targetAsset.code),
    [assets, targetAsset.code],
  );
  const [sourceAssetCode, setSourceAssetCode] = useState<SendAssetCode>(
    targetAsset.code === 'NGN' ? 'USDC' : 'NGN',
  );
  const [decryptedBalances, setDecryptedBalances] = useState<Partial<Record<StablecoinAssetCode, DecryptedConversionBalance>>>({});
  const [decryptingAssetCode, setDecryptingAssetCode] = useState<StablecoinAssetCode>();
  const sourceAssetOptions = useMemo(
    () => sourceAssetOptionsBase.map((asset) => applyDecryptedConversionBalance(asset, decryptedBalances)),
    [decryptedBalances, sourceAssetOptionsBase],
  );
  const sourceAsset =
    sourceAssetOptions.find((asset) => asset.code === sourceAssetCode) ??
    sourceAssetOptions[0] ??
    targetAsset;
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [receiveInput, setReceiveInput] = useState('');
  const [activeAmountField, setActiveAmountField] = useState<'source' | 'target'>('source');
  const [errorMessage, setErrorMessage] = useState('');
  const [quoteErrorRecord, setQuoteErrorRecord] = useState<{ key: string; message: string }>();
  const [quoteRecord, setQuoteRecord] = useState<{ key: string; quote: KlydeQuote }>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const numericAmount = parseEditableAmount(amount);
  const desiredReceiveAmount = parseEditableAmount(receiveInput);
  const quoteRequestKey = `${sourceAsset.code}:${targetAsset.code}:${amount}`;
  const quote = quoteRecord?.key === quoteRequestKey ? quoteRecord.quote : undefined;
  const quoteError = quoteErrorRecord?.key === quoteRequestKey ? quoteErrorRecord.message : '';
  const sourceBalanceDecrypting = isStablecoinAsset(sourceAsset.code) && decryptingAssetCode === sourceAsset.code;
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
  const receiveInputValue =
    activeAmountField === 'target'
      ? formatEditableDisplayAmount(receiveInput, targetAsset)
      : receiveAmount > 0
        ? formatDisplayInputAmount(receiveAmount, targetAsset)
        : '';
  const sourceInputValue =
    amount && activeAmountField === 'source'
      ? formatEditableDisplayAmount(amount, sourceAsset)
      : amount
        ? formatDisplayInputAmount(numericAmount, sourceAsset)
        : '';
  const receiveAmountLabel =
    runtimeConfig.realIntegrationsEnabled && numericAmount > 0 && !quote
      ? '...'
      : formatMoney(receiveAmount, targetAsset);
  const targetQuoteReady =
    activeAmountField !== 'target' ||
    desiredReceiveAmount <= 0 ||
    !quote?.settlementAmount ||
    moneyAmountsCloseForConversion({
      actual: moneyAmountToNumber(quote.settlementAmount),
      expected: desiredReceiveAmount,
      sourceAsset,
      targetAsset,
    });
  const quotePending = runtimeConfig.realIntegrationsEnabled && numericAmount > 0 && (!quote || !targetQuoteReady);
  const feeLabel = quote
    ? readQuoteFeeLabel(quote, sourceAsset)
    : quotePending
      ? '-'
      : `- ${formatMoney(fallbackFee, sourceAsset)}`;
  const rateLabel = quote
    ? readQuoteRateLabel(quote, sourceAsset, targetAsset)
    : runtimeConfig.realIntegrationsEnabled
      ? '-'
      : readRateLabel(sourceAsset, targetAsset);
  const sourceBalanceUnavailable = Boolean(sourceAsset.balanceUnavailable);
  const availableSourceBalance = parseAssetBalance(sourceAsset);
  const sourceBalanceAfterConversion = Math.max(availableSourceBalance - numericAmount, 0);
  const sourceBalanceHint =
    sourceBalanceUnavailable
      ? `${sourceAsset.symbol}••••`
      : numericAmount > 0
      ? `${sourceAsset.symbol}${formatBalancePreview(sourceBalanceAfterConversion, sourceAsset)}`
      : `${sourceAsset.symbol}${sourceAsset.balance}`;
  const hasEnoughSourceBalance = sourceBalanceUnavailable ? numericAmount <= 0 : numericAmount <= availableSourceBalance;
  const canSubmit =
    receiveAmount > 0 &&
    hasEnoughSourceBalance &&
    !submitting &&
    !sourceBalanceDecrypting &&
    !quoteLoading &&
    (!runtimeConfig.realIntegrationsEnabled || (Boolean(quote) && targetQuoteReady));

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 4500);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  useEffect(() => {
    if (!quoteErrorRecord) {
      return;
    }

    const timeout = setTimeout(() => setQuoteErrorRecord(undefined), 4500);

    return () => clearTimeout(timeout);
  }, [quoteErrorRecord]);

  useEffect(() => {
    if (!isStablecoinAsset(sourceAssetCode) || decryptedBalances[sourceAssetCode]) {
      return;
    }

    const assetCode = sourceAssetCode;
    let active = true;

    Promise.resolve()
      .then(() => {
        if (active) {
          setDecryptingAssetCode(assetCode);
        }

        return getPaayeeConfidentialBalanceDisplay({
          assetCode,
          chainId: readConfidentialConversionChainId(),
          hasOperationHistory: true,
          owner: data?.wallet?.address,
        });
      })
      .then((balance) => {
        if (!active || balance.status !== 'available' || !balance.displayAmount) {
          return;
        }

        const displayAmount = balance.displayAmount;
        setDecryptedBalances((current) => ({
          ...current,
          [assetCode]: {
            balance: stripPrivateStablecoinDisplay(displayAmount),
            displayAmount,
          },
        }));
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(readConversionErrorMessage(error, assetCode));
        }
      })
      .finally(() => {
        if (active) {
          setDecryptingAssetCode(undefined);
        }
      });

    return () => {
      active = false;
    };
  }, [data?.wallet?.address, decryptedBalances, sourceAssetCode]);

  useEffect(() => {
    if (!runtimeConfig.realIntegrationsEnabled || numericAmount <= 0) {
      const timeout = setTimeout(() => setQuoteLoading(false), 0);

      return () => clearTimeout(timeout);
    }

    if (quote) {
      const timeout = setTimeout(() => setQuoteLoading(false), 0);

      return () => clearTimeout(timeout);
    }

    if (quoteError) {
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
            setQuoteErrorRecord({
              key: quoteRequestKey,
              message: 'We could not get a conversion quote right now.',
            });
            return;
          }

          setQuoteRecord({ key: quoteRequestKey, quote: nextQuote });
        })
        .catch((quoteFailure) => {
          if (active) {
            setQuoteErrorRecord({
              key: quoteRequestKey,
              message: readConversionErrorMessage(quoteFailure, sourceAsset.code),
            });
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
  }, [numericAmount, quote, quoteError, quoteRequestKey, sourceAsset.code, targetAsset.code]);

  useEffect(() => {
    if (
      !runtimeConfig.realIntegrationsEnabled ||
      activeAmountField !== 'target' ||
      desiredReceiveAmount <= 0 ||
      !quote?.settlementAmount
    ) {
      return;
    }

    const quotedTargetAmount = moneyAmountToNumber(quote.settlementAmount);

    if (
      moneyAmountsCloseForConversion({
        actual: quotedTargetAmount,
        expected: desiredReceiveAmount,
        sourceAsset,
        targetAsset,
      })
    ) {
      return;
    }

    const quotedSourceAmount = moneyAmountToNumber(quote.sourceAmount);
    const liveRate = quotedTargetAmount / quotedSourceAmount;

    if (!Number.isFinite(liveRate) || liveRate <= 0) {
      return;
    }

    const nextSourceAmount = desiredReceiveAmount / liveRate;
    const nextAmount = formatEditableAmount(nextSourceAmount, sourceAsset);

    if (!nextAmount || nextAmount === amount) {
      return;
    }

    const timeout = setTimeout(() => setAmount(nextAmount), 0);

    return () => clearTimeout(timeout);
  }, [activeAmountField, amount, desiredReceiveAmount, quote, sourceAsset, targetAsset]);

  const overlay = <FeedbackToast message={errorMessage || quoteError} tone="error" />;

  if (sourceBalanceDecrypting) {
    return (
      <AddMoneyShell overlay={overlay}>
        <TopBar />
        <ConversionPageDecryptingSkeleton />
        <FooterButton disabled label="Preparing..." onPress={() => undefined} />
      </AddMoneyShell>
    );
  }

  return (
    <AddMoneyShell overlay={overlay}>
      <TopBar />
      <FadeInView delay={60} style={styles.heroCopy}>
        <Text style={styles.title}>Add {targetAsset.code} via conversion</Text>
        <Text style={styles.subtitle}>Convert from one Paayee balance into your {targetAsset.name} balance.</Text>
      </FadeInView>

      <FadeInView delay={120} style={{ gap: 20 }}>
        <Text style={sendAmountStyles.fieldLabel}>You convert</Text>
        <View style={sendAmountStyles.amountCard}>
          <View style={sendAmountStyles.amountTop}>
            <AssetPill asset={sourceAsset} onPress={() => setAssetPickerOpen(true)} />
            <TextInput
              value={sourceInputValue}
              onChangeText={(value) => {
                setActiveAmountField('source');
                setReceiveInput('');
                setAmount(sanitizeAmountInput(value, sourceAsset));
              }}
              onFocus={() => setActiveAmountField('source')}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#B7BDC8"
              style={sendAmountStyles.amountInput}
            />
          </View>
          <Text style={sendAmountStyles.balanceHint}>Bal: {sourceBalanceHint}</Text>
        </View>
        {numericAmount > 0 && !hasEnoughSourceBalance ? (
          <Text style={sendAmountStyles.errorText}>
            {sourceBalanceUnavailable
              ? `Decrypt your private ${sourceAsset.code} balance before converting from it.`
              : `You do not have enough ${sourceAsset.code} available to convert.`}
          </Text>
        ) : null}

        <View style={sendAmountStyles.feeCard}>
          <SummaryRow
            label="Transaction fee"
            value={feeLabel}
            valueNode={quotePending ? <SkeletonBlock style={sendAmountStyles.summaryValueSkeleton} /> : undefined}
          />
          <View style={sendAmountStyles.reviewDivider} />
          <SummaryRow
            label="Amount you will receive"
            value={`= ${receiveAmountLabel}`}
            valueNode={quotePending ? <SkeletonBlock style={sendAmountStyles.summaryValueSkeleton} /> : undefined}
          />
          <SummaryRow
            label="Today's rate"
            value={rateLabel}
            valueNode={quotePending ? <SkeletonBlock style={sendAmountStyles.summaryValueSkeleton} /> : undefined}
          />
        </View>

        <Text style={sendAmountStyles.fieldLabel}>Amount you will receive</Text>
        <View style={sendAmountStyles.receiveAmountCard}>
          <StaticAssetPill asset={targetAsset} />
          <TextInput
            value={receiveInputValue}
            onChangeText={(value) => {
              const nextValue = sanitizeAmountInput(value, targetAsset);
              const nextDesiredReceiveAmount = parseEditableAmount(nextValue);
              const nextSourceAmount = estimateSourceAmountForReceive(
                nextDesiredReceiveAmount,
                sourceAsset,
                targetAsset,
              );

              setActiveAmountField('target');
              setReceiveInput(nextValue);
              setAmount(formatEditableAmount(nextSourceAmount, sourceAsset));
            }}
            onFocus={() => setActiveAmountField('target')}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#B7BDC8"
            style={sendAmountStyles.receiveAmount}
          />
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
            if (__DEV__) {
              console.log('[Paayee conversion] submitting conversion', {
                quoteId: quote?.id,
                sourceAssetCode: sourceAsset.code,
                targetAssetCode: targetAsset.code,
                amount,
              });
            }

            const privateConversion = isPrivateStablecoinConversion({
              sourceAssetCode: sourceAsset.code,
              targetAssetCode: targetAsset.code,
            });

            if (privateConversion) {
              const conversion = await executeLivePrivateStablecoinConversion({
                amount: numericAmount,
                chainId: readConfidentialConversionChainId(),
                rateLabel,
                sourceAssetCode: sourceAsset.code,
                targetAmount: receiveAmount,
                targetAssetCode: targetAsset.code,
              });

              if (conversion) {
                const targetAmount = conversion.envelope.targetAmountDisplay ?? formatMoney(receiveAmount, targetAsset);

                router.replace(
                  `/operation-success?title=${encodeURIComponent('Conversion prepared')}&amount=${encodeURIComponent(
                    targetAmount,
                  )}&asset=${encodeURIComponent(targetAsset.code)}&kind=private-conversion&transactionId=${encodeURIComponent(
                    conversion.operation.id,
                  )}&privateEnvelopeId=${encodeURIComponent(conversion.envelope.id)}&status=${encodeURIComponent(
                    conversion.operation.status,
                  )}` as Href,
                );
                return;
              }
            }

            if (isPrivateStablecoinToNgnConversion({
              sourceAssetCode: sourceAsset.code,
              targetAssetCode: targetAsset.code,
            })) {
              const conversion = await prepareLivePrivateConversionSettlement({
                amount: numericAmount,
                chainId: readConfidentialConversionChainId(),
                rateLabel,
                sourceAssetCode: sourceAsset.code,
                targetAmount: receiveAmount,
                targetAssetCode: targetAsset.code,
              });

              if (conversion) {
                const targetAmount = conversion.envelope.targetAmountDisplay ?? formatMoney(receiveAmount, targetAsset);
                const completed = conversion.operation.status === 'succeeded';

                router.replace(
                  `/operation-success?title=${encodeURIComponent(completed ? 'NGN settlement complete' : 'NGN settlement prepared')}&amount=${encodeURIComponent(
                    targetAmount,
                  )}&asset=${encodeURIComponent(targetAsset.code)}&kind=private-conversion&transactionId=${encodeURIComponent(
                    conversion.operation.id,
                  )}&privateEnvelopeId=${encodeURIComponent(conversion.envelope.id)}&status=${encodeURIComponent(
                    conversion.operation.status,
                  )}` as Href,
                );
                return;
              }
            }

            if (isNgnToPrivateStablecoinConversion({
              sourceAssetCode: sourceAsset.code,
              targetAssetCode: targetAsset.code,
            })) {
              const conversion = await prepareLivePrivateConversionSettlement({
                amount: numericAmount,
                chainId: readConfidentialConversionChainId(),
                rateLabel,
                sourceAssetCode: sourceAsset.code,
                targetAmount: receiveAmount,
                targetAssetCode: targetAsset.code,
              });

              if (conversion) {
                const targetAmount = conversion.envelope.targetAmountDisplay ?? formatMoney(receiveAmount, targetAsset);

                router.replace(
                  `/operation-success?title=${encodeURIComponent('Private conversion prepared')}&amount=${encodeURIComponent(
                    targetAmount,
                  )}&asset=${encodeURIComponent(targetAsset.code)}&kind=private-conversion&transactionId=${encodeURIComponent(
                    conversion.operation.id,
                  )}&privateEnvelopeId=${encodeURIComponent(conversion.envelope.id)}&status=${encodeURIComponent(
                    conversion.operation.status,
                  )}` as Href,
                );
                return;
              }
            }

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
            if (__DEV__) {
              console.warn(
                '[Paayee conversion] conversion failed',
                JSON.stringify(formatConversionErrorForLog(conversionError)),
              );
            }
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
            if (activeAmountField === 'target') {
              const nextSourceAmount = estimateSourceAmountForReceive(
                parseEditableAmount(receiveInput),
                nextAsset,
                targetAsset,
              );
              setAmount(formatEditableAmount(nextSourceAmount, nextAsset));
            }
          }
          setAssetPickerOpen(false);
        }}
        selectedAsset={sourceAsset}
        assets={sourceAssetOptions}
      />
    </AddMoneyShell>
  );
}

function ConversionPageDecryptingSkeleton() {
  return (
    <>
      <FadeInView delay={60} style={styles.heroCopy}>
        <SkeletonBlock style={{ alignSelf: 'center', width: 238, height: 34, borderRadius: 17 }} />
        <SkeletonBlock style={{ alignSelf: 'center', width: 284, height: 18, borderRadius: 9 }} />
      </FadeInView>

      <FadeInView delay={120} style={{ gap: 20 }}>
        <SkeletonBlock style={{ width: 96, height: 14, borderRadius: 7 }} />

        <View style={sendAmountStyles.amountCard}>
          <View style={sendAmountStyles.amountTop}>
            <SkeletonBlock style={{ width: 132, height: 46, borderRadius: 23 }} />
            <SkeletonBlock style={{ width: 142, height: 40, borderRadius: 20 }} />
          </View>
          <SkeletonBlock style={{ width: 176, height: 15, borderRadius: 8 }} />
        </View>

        <View style={sendAmountStyles.feeCard}>
          <View style={sendAmountStyles.summaryRow}>
            <SkeletonBlock style={{ width: 112, height: 14, borderRadius: 7 }} />
            <SkeletonBlock style={{ width: 86, height: 16, borderRadius: 8 }} />
          </View>
          <View style={sendAmountStyles.reviewDivider} />
          <View style={sendAmountStyles.summaryRow}>
            <SkeletonBlock style={{ width: 158, height: 14, borderRadius: 7 }} />
            <SkeletonBlock style={{ width: 114, height: 16, borderRadius: 8 }} />
          </View>
          <View style={sendAmountStyles.summaryRow}>
            <SkeletonBlock style={{ width: 92, height: 14, borderRadius: 7 }} />
            <SkeletonBlock style={{ width: 136, height: 16, borderRadius: 8 }} />
          </View>
        </View>

        <SkeletonBlock style={{ width: 166, height: 14, borderRadius: 7 }} />
        <View style={sendAmountStyles.receiveAmountCard}>
          <SkeletonBlock style={{ width: 128, height: 44, borderRadius: 22 }} />
          <SkeletonBlock style={{ width: 132, height: 32, borderRadius: 16 }} />
        </View>

        <View style={sendAmountStyles.arrivalHint}>
          <SkeletonBlock style={{ width: 18, height: 18, borderRadius: 9 }} />
          <SkeletonBlock style={{ width: 188, height: 14, borderRadius: 7 }} />
        </View>
      </FadeInView>
    </>
  );
}

function parseAssetBalance(asset: SendAssetOption): number {
  return Number(asset.balance.replace(/,/g, '')) || 0;
}

function applyDecryptedConversionBalance(
  asset: SendAssetOption,
  balances: Partial<Record<StablecoinAssetCode, DecryptedConversionBalance>>,
): SendAssetOption {
  if (!isStablecoinAsset(asset.code)) {
    return asset;
  }

  const balance = balances[asset.code];

  if (!balance) {
    return asset;
  }

  return {
    ...asset,
    balance: balance.balance,
    balanceUnavailable: false,
  };
}

function stripPrivateStablecoinDisplay(value: string): string {
  return value.replace(/[^\d.,-]/g, '').replace(/,+$/, '') || '0.00';
}

function sanitizeAmountInput(value: string, asset: SendAssetOption): string {
  const scale = getMoneyInputScale(asset);
  const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = cleaned.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, 12);

  if (fractionParts.length === 0) {
    return normalizedWhole;
  }

  return `${normalizedWhole || '0'}.${fractionParts.join('').slice(0, scale)}`;
}

function parseEditableAmount(value: string): number {
  return Number(value.replace(/,/g, '')) || 0;
}

function formatEditableAmount(value: number, asset: SendAssetOption): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  const maximumFractionDigits = getMoneyInputScale(asset);

  return value
    .toLocaleString('en-US', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
      useGrouping: false,
    })
    .replace(/\.0+$/, '');
}

function formatEditableDisplayAmount(value: string, asset: SendAssetOption): string {
  if (!value) {
    return '';
  }

  const [whole = '', fraction] = value.split('.');
  const formattedWhole = whole ? Number(whole).toLocaleString('en-US') : '0';

  if (fraction === undefined) {
    return formattedWhole;
  }

  const scale = getMoneyInputScale(asset);
  return `${formattedWhole}.${fraction.slice(0, scale)}`;
}

function formatDisplayInputAmount(value: number, asset: SendAssetOption): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  const maximumFractionDigits = getMoneyInputScale(asset);

  return value.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatBalancePreview(value: number, asset: SendAssetOption): string {
  const maximumFractionDigits = getMoneyDisplayScale(asset);
  const safeValue = Number.isFinite(value) ? Math.max(value, 0) : 0;

  return safeValue.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function moneyAmountsCloseForConversion(input: {
  actual: number;
  expected: number;
  sourceAsset: SendAssetOption;
  targetAsset: SendAssetOption;
}): boolean {
  const targetTolerance = 1 / 10 ** getMoneyInputScale(input.targetAsset);
  const estimatedSourceAmount = estimateSourceAmountForReceive(input.expected, input.sourceAsset, input.targetAsset);
  const estimatedRate = input.actual / Math.max(estimatedSourceAmount, 1e-12);
  const sourceStepValue = 1 / 10 ** getMoneyInputScale(input.sourceAsset);
  const sourceRoundingTolerance =
    Number.isFinite(estimatedRate) && estimatedRate > 0 ? sourceStepValue * estimatedRate : 0;
  const tolerance = Math.max(targetTolerance, sourceRoundingTolerance);

  return Math.abs(input.actual - input.expected) <= tolerance;
}

function getMoneyInputScale(asset: SendAssetOption): number {
  if (asset.code === 'USDC' || asset.code === 'USDT') {
    return 6;
  }

  return 2;
}

function getMoneyDisplayScale(_asset: SendAssetOption): number {
  return 2;
}

function estimateSourceAmountForReceive(
  desiredReceiveAmount: number,
  sourceAsset: SendAssetOption,
  targetAsset: SendAssetOption,
): number {
  if (desiredReceiveAmount <= 0) {
    return 0;
  }

  if (sourceAsset.code === targetAsset.code) {
    return desiredReceiveAmount;
  }

  if (sourceAsset.code === 'NGN') {
    return desiredReceiveAmount * 1485 + getTransferFee(sourceAsset.code);
  }

  if (targetAsset.code === 'NGN') {
    return desiredReceiveAmount / 1485;
  }

  if (sourceAsset.code === 'USDC' && targetAsset.code === 'USDT') {
    return desiredReceiveAmount / 0.998;
  }

  if (sourceAsset.code === 'USDT' && targetAsset.code === 'USDC') {
    return desiredReceiveAmount / 0.997;
  }

  return desiredReceiveAmount;
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
    return formatMoney(0, sourceAsset);
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

  if (normalized.includes('metadata key') || normalized.includes('receipt key')) {
    return 'Could not unlock private receipt encryption. Reopen Paayee and try again.';
  }

  if (normalized.includes('unshield')) {
    return 'Could not move your private stablecoin into NGN settlement. Please try again.';
  }

  if (normalized.includes('smart-account') || normalized.includes('smart account')) {
    return 'Could not reach your Paayee smart wallet. Reopen Paayee and try again.';
  }

  if (normalized.includes('without an id') || normalized.includes('quoteid')) {
    return 'We could not get a valid conversion quote. Refresh the amount and try again.';
  }

  if (normalized.includes('insufficient')) {
    return `You do not have enough ${sourceAssetCode} available to convert.`;
  }

  if (normalized.includes('expired')) {
    return 'This rate has expired. Refresh the quote and try again.';
  }

  if (normalized.includes('confidential') || normalized.includes('private')) {
    return message || 'This conversion needs Paayee confidential rails before it can continue.';
  }

  if (normalized.includes('rate') || normalized.includes('provider')) {
    return 'We could not get a conversion rate right now. Please try again.';
  }

  if (normalized.includes('quote')) {
    return 'We could not confirm this quote. Please try again.';
  }

  return 'Could not complete this conversion. Please try again.';
}

function formatConversionErrorForLog(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
    };
  }

  const candidate = error as Error & {
    cause?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  return {
    cause: candidate.cause ? formatConversionErrorForLog(candidate.cause) : undefined,
    code: candidate.code,
    message: candidate.message,
    name: candidate.name,
    stack: candidate.stack?.split('\n').slice(0, 5).join('\n'),
    status: candidate.status,
    statusCode: candidate.statusCode,
  };
}

function readConfidentialConversionChainId(): number {
  return getKlydeConfig().environment === 'production' ? 11155111 : 31337;
}
