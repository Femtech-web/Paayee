import { Feather } from '@react-native-vector-icons/feather';
import * as Clipboard from 'expo-clipboard';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/loading/skeleton';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import {
  getPaayeePrivateOperationEnvelope,
  type PaayeePrivateOperationEnvelope,
} from '@/features/confidential/confidential-money';
import {
  decryptPaayeeZamaEncryptedValue,
  getPaayeeWalletAddress,
} from '@/features/confidential/zama-mobile-runtime';
import { runtimeConfig } from '@/config/runtime';
import {
  getPaayeeActivityReceipt,
  getPaayeeChainActivity,
  type PaayeeOperation,
  type PaayeeReceipt,
} from '@/integrations/paayee';
import {
  getKlydeConversion,
  getKlydeReceipt,
  listKlydeConfidentialOperations,
  listKlydeTransactions,
  type KlydeConfidentialOperation,
  type KlydeConversion,
  type KlydeReceipt,
  type KlydeTimelineItem,
  type KlydeTransaction,
  type MoneyAmount,
} from '@/integrations/klyde';

import { styles } from './transaction-detail-screen.styles';

type DisplayIcon = 'arrow-down-left' | 'arrow-up-right' | 'repeat';

type DetailRecord =
  | {
      kind: 'conversion';
      value: KlydeConversion;
    }
  | {
      kind: 'receipt';
      privateCreditOperation?: KlydeConfidentialOperation;
      transaction?: KlydeTransaction;
      value: KlydeReceipt;
    }
  | {
      kind: 'private';
      operationId: string;
      value: PaayeePrivateOperationEnvelope;
    }
  | {
      kind: 'paayee-receipt';
      value: PaayeeReceipt;
    }
  | {
      kind: 'paayee-operation';
      value: PaayeeOperation;
    };

export function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    privateEnvelopeId?: string;
    receiptId?: string;
    returnTo?: string;
    transactionId?: string;
  }>();
  const transactionId = readParam(params.transactionId);
  const receiptId = readParam(params.receiptId);
  const privateEnvelopeId = readParam(params.privateEnvelopeId);
  const kind = readParam(params.kind);
  const returnTo = readParam(params.returnTo);
  const [record, setRecord] = useState<DetailRecord>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedTransactionHash, setCopiedTransactionHash] = useState('');

  const loadTransaction = useCallback(async () => {
    if (!transactionId) {
      setErrorMessage('Transaction not found.');
      setLoading(false);
      return;
    }

    try {
      setErrorMessage('');

      if (kind === 'conversion') {
        const conversion = await getKlydeConversion({ conversionId: transactionId });
        setRecord({ kind: 'conversion', value: conversion });
        return;
      }

      if (kind === 'private-send' || kind === 'private-conversion') {
        const ownerAddress = await getPaayeeWalletAddress().catch(() => undefined);
        const envelope = ownerAddress
          ? await getPaayeePrivateOperationEnvelope(privateEnvelopeId, ownerAddress)
          : undefined;
        if (envelope) {
          setRecord({ kind: 'private', operationId: transactionId, value: envelope });
          return;
        }

        setErrorMessage('Private receipt payload is unavailable on this device.');
        return;
      }

      if (receiptId && (kind === 'deposit' || kind === 'private-receive' || kind === 'shield' || kind === 'unshield' || kind === 'send')) {
        const receipt = await getPaayeeActivityReceipt(receiptId);
        setRecord({ kind: 'paayee-receipt', value: await revealPrivateReceiptAmount(receipt) });
        return;
      }

      if (kind === 'send' || kind === 'shield' || kind === 'unshield') {
        const activity = await getPaayeeChainActivity();
        const operationId = stripPaayeeActivityPrefix(transactionId);
        const operation = activity.operations.find((item) =>
          item.id === operationId || item.transaction_hash.toLowerCase() === operationId.toLowerCase());
        const receipt = operation
          ? activity.receipts.find((item) => item.operation_id === operation.id)
          : undefined;
        if (receipt) {
          setRecord({ kind: 'paayee-receipt', value: receipt });
          return;
        }
        if (operation) {
          setRecord({ kind: 'paayee-operation', value: operation });
          return;
        }

        setErrorMessage('This transaction has not reached Paayee yet. Pull down to check again.');
        return;
      }

      if (receiptId) {
        const receipt = await getKlydeReceipt({ receiptId });
        const privateCreditOperation = await resolvePrivateCreditOperation(receipt);
        setRecord({ kind: 'receipt', privateCreditOperation, value: receipt });
        return;
      }

      const transactions = await listKlydeTransactions({ page: 1, pageSize: 50 });
      const transaction = transactions.data.find(
        (item) => item.id === transactionId || item.receiptId === transactionId,
      );

      if (transaction) {
        const privateCreditOperation = await resolvePrivateCreditOperation(transaction.receipt);
        setRecord({ kind: 'receipt', privateCreditOperation, transaction, value: transaction.receipt });
        return;
      }

      setErrorMessage('Transaction not found.');
    } catch (transactionError) {
      setErrorMessage(
        transactionError instanceof Error
          ? transactionError.message
          : 'Could not load this transaction.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, privateEnvelopeId, receiptId, transactionId]);

  useEffect(() => {
    void Promise.resolve().then(loadTransaction);
  }, [loadTransaction]);

  useEffect(() => {
    if (!record || isTerminalRecord(record)) {
      return;
    }

    const timer = setInterval(() => {
      void loadTransaction();
    }, 5000);

    return () => clearInterval(timer);
  }, [loadTransaction, record]);

  const display = useMemo(() => (record ? createDisplay(record) : undefined), [record]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Colors.light.primary}
            onRefresh={() => {
              setRefreshing(true);
              void loadTransaction();
            }}
          />
        }>
        <View style={styles.topBar}>
          <PressableScale
            onPress={() => {
              if (returnTo === 'home') {
                router.replace('/' as Href);
                return;
              }

              router.back();
            }}
            style={styles.circleButton}>
            <Feather name="chevron-left" size={26} color={Colors.light.black} />
          </PressableScale>
          <PressableScale style={styles.circleButton}>
            <Feather name="help-circle" size={22} color={Colors.light.black} />
          </PressableScale>
        </View>

        {loading ? (
          <TransactionDetailSkeleton />
        ) : display ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Feather name={display.icon} size={32} color="#2D3441" />
                <View style={styles.assetDot}>
                  <Text style={styles.assetDotText}>{getAssetBadgeText(display.assetCode)}</Text>
                </View>
              </View>
              <Text style={styles.heroAmount}>{display.amount}</Text>
              <Text style={styles.heroSubtitle}>{display.subtitle}</Text>
              <Text style={styles.heroDate}>{display.date}</Text>
            </View>

            <View style={styles.paperEdge} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transaction details</Text>
              <View style={styles.detailRows}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <StatusPill status={display.status} />
                </View>
                {display.rows.map((row) => (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    {row.copyValue ? (
                      <PressableScale
                        accessibilityHint="Copies the complete transaction hash"
                        accessibilityLabel="Copy transaction hash"
                        accessibilityRole="button"
                        onPress={() => {
                          void Clipboard.setStringAsync(row.copyValue ?? '');
                          setCopiedTransactionHash(row.copyValue ?? '');
                        }}
                        style={styles.detailValueAction}>
                        <Text selectable numberOfLines={2} style={styles.detailValueActionText}>
                          {row.value}
                        </Text>
                        <Feather
                          name={copiedTransactionHash === row.copyValue ? 'check' : 'copy'}
                          size={15}
                          color={copiedTransactionHash === row.copyValue ? '#2F8F46' : '#697386'}
                        />
                      </PressableScale>
                    ) : (
                      <Text selectable numberOfLines={2} style={styles.detailValue}>
                        {row.value}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionBand}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              <View style={styles.timeline}>
                {display.timeline.map((item, index) => (
                  <TimelineRow
                    key={`${item.step}-${index}`}
                    isLast={index === display.timeline.length - 1}
                    item={item}
                  />
                ))}
              </View>
            </View>
            <View style={styles.footer}>
              <PressableScale
                onPress={() => {
                  void Share.share({
                    message: `${display.subtitle}\n${display.amount}\n${display.date}`,
                  });
                }}
                style={styles.primaryButton}>
                <Feather name="share-2" size={17} color={Colors.light.white} />
                <Text style={styles.primaryButtonText}>Share receipt</Text>
              </PressableScale>
              {display.canRepeat ? (
                <PressableScale style={styles.secondaryFooterButton}>
                  <Text style={styles.secondaryFooterButtonText}>Repeat transaction</Text>
                </PressableScale>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="file-text" size={24} color={Colors.light.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Transaction unavailable</Text>
            <Text style={styles.emptyText}>{errorMessage || 'We could not find this transaction.'}</Text>
            <PressableScale onPress={() => router.replace('/transactions' as Href)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to transactions</Text>
            </PressableScale>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = getStatusTone(status);

  return (
    <View style={[styles.statusPill, tone === 'error' && styles.statusPillError, tone === 'pending' && styles.statusPillPending]}>
      <View style={[styles.statusDot, tone === 'error' && styles.statusDotError, tone === 'pending' && styles.statusDotPending]} />
      <Text style={[styles.statusText, tone === 'error' && styles.statusTextError, tone === 'pending' && styles.statusTextPending]}>
        {formatStatus(status)}
      </Text>
    </View>
  );
}

function TimelineRow({ isLast, item }: { isLast: boolean; item: KlydeTimelineItem }) {
  const tone =
    item.status === 'failed'
      ? 'error'
      : item.status === 'completed'
        ? 'success'
        : 'pending';

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineMarkerColumn}>
        <View
          style={[
            styles.timelineMarker,
            tone === 'error' && styles.timelineMarkerError,
            tone === 'pending' && styles.timelineMarkerPending,
          ]}>
          <Feather
            name={item.status === 'failed' ? 'x' : tone === 'pending' ? 'clock' : 'check'}
            size={15}
            color={Colors.light.white}
          />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.timelineText}>{formatTimelineDescription(item)}</Text> : null}
        {item.timestamp ? <Text style={styles.timelineDate}>{formatLongDate(item.timestamp)}</Text> : null}
      </View>
    </View>
  );
}

function TransactionDetailSkeleton() {
  return (
    <>
      <View style={styles.hero}>
        <SkeletonBlock style={styles.heroIconSkeleton} />
        <SkeletonBlock style={styles.heroAmountSkeleton} />
        <SkeletonBlock style={styles.heroSubtitleSkeleton} />
      </View>
      <View style={styles.section}>
        <SkeletonBlock style={styles.sectionTitleSkeleton} />
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.detailRow}>
            <SkeletonBlock style={styles.detailLabelSkeleton} />
            <SkeletonBlock style={styles.detailValueSkeleton} />
          </View>
        ))}
      </View>
    </>
  );
}

function createDisplay(record: DetailRecord): {
  amount: string;
  assetCode: string;
  canRepeat: boolean;
  date: string;
  icon: DisplayIcon;
  rows: { copyValue?: string; label: string; value: string }[];
  status: string;
  subtitle: string;
  timeline: KlydeTimelineItem[];
} {
  if (record.kind === 'paayee-receipt') {
    const receipt = record.value;
    const assetCode = receipt.token_symbol ?? 'USDC';
    const decimals = receipt.token_decimals ?? 6;
    const privateIncoming = receipt.receipt_type === 'private_receive';
    const numericAmount = receipt.amount_minor_units === undefined
      ? undefined
      : Number(receipt.amount_minor_units) / 10 ** decimals;
    const amount = numericAmount === undefined
      ? `Private ${assetCode}`
      : `${numericAmount.toLocaleString(undefined, {
          maximumFractionDigits: decimals,
          minimumFractionDigits: 2,
        })} ${assetCode}`;
    const incoming = receipt.receipt_type === 'deposit' || privateIncoming;
    const sender = receipt.sender_handle
      ?? receipt.sender_name
      ?? (receipt.from_address ? shortenAddress(receipt.from_address) : undefined);

    return {
      amount: incoming && numericAmount !== undefined ? `+${amount}` : amount,
      assetCode,
      canRepeat: false,
      date: formatLongDate(receipt.created_at),
      icon: incoming ? 'arrow-down-left' : receipt.receipt_type === 'shield' ? 'arrow-down-left' : 'arrow-up-right',
      rows: [
        { label: 'Asset', value: assetCode },
        { label: privateIncoming ? 'Private amount received' : incoming ? 'Public amount received' : 'Amount', value: amount },
        ...(privateIncoming && sender ? [{ label: 'From', value: sender }] : []),
        {
          label: 'Transaction',
          value: receipt.transaction_hash ? shortenAddress(receipt.transaction_hash) : 'Pending',
          ...(receipt.transaction_hash ? { copyValue: receipt.transaction_hash } : {}),
        },
      ],
      status: receipt.status,
      subtitle: receipt.detail,
      timeline: ensureTimeline(undefined, receipt.status, receipt.receipt_type),
    };
  }

  if (record.kind === 'paayee-operation') {
    const operation = record.value;
    const assetCode = operation.token_symbol;
    const numericAmount = Number(operation.amount_minor_units) / 1_000_000;
    const amount = `${numericAmount.toLocaleString(undefined, {
      maximumFractionDigits: 6,
      minimumFractionDigits: 2,
    })} ${assetCode}`;
    const operationKind = operation.kind === 'public_send' ? 'send' : operation.kind;
    const subtitle = operation.kind === 'public_send'
      ? operation.status === 'confirmed' ? 'Spendable transfer confirmed.' : 'Spendable transfer submitted.'
      : operation.kind === 'shield'
        ? 'Making this balance private.'
        : 'Moving this balance to spendable.';

    return {
      amount,
      assetCode,
      canRepeat: false,
      date: formatLongDate(operation.created_at),
      icon: operation.kind === 'shield' ? 'arrow-down-left' : 'arrow-up-right',
      rows: [
        { label: 'Asset', value: assetCode },
        { label: 'Amount', value: amount },
        ...(operation.destination_address
          ? [{ label: 'Destination', value: shortenAddress(operation.destination_address) }]
          : []),
        {
          copyValue: operation.transaction_hash,
          label: 'Transaction',
          value: shortenAddress(operation.transaction_hash),
        },
      ],
      status: operation.status,
      subtitle,
      timeline: ensureTimeline(undefined, operation.status, operationKind),
    };
  }

  if (record.kind === 'conversion') {
    const conversion = record.value;
    const isPrivateStablecoinConversion =
      isStablecoinCurrency(conversion.sourceAmount.currency) ||
      isStablecoinCurrency(conversion.targetAmount.currency);

    if (isPrivateStablecoinConversion) {
      return {
        amount: 'Private amount',
        assetCode: conversion.targetAmount.currency,
        canRepeat: false,
        date: formatLongDate(conversion.createdAt),
        icon: 'repeat' as const,
        rows: [
          { label: 'Private operation', value: conversion.id },
          { label: 'Status', value: formatStatus(conversion.status) },
        ],
        status: conversion.status,
        subtitle: 'Decrypt the private receipt payload to view amount details',
        timeline: ensureTimeline(conversion.timeline, conversion.status, 'private conversion'),
      };
    }

    return {
      amount: formatMoneyAmountWithAsset(conversion.targetAmount),
      assetCode: conversion.targetAmount.currency,
      canRepeat: false,
      date: formatLongDate(conversion.createdAt),
      icon: 'repeat' as const,
      rows: [
        { label: 'You received', value: formatMoneyAmountWithAsset(conversion.targetAmount) },
        { label: 'You converted', value: formatMoneyAmountWithAsset(conversion.sourceAmount) },
        ...(conversion.rateReference ? [{ label: 'Rate reference', value: conversion.rateReference }] : []),
      ],
      status: conversion.status,
      subtitle: `Converted to ${conversion.targetAmount.currency}`,
      timeline: ensureTimeline(conversion.timeline, conversion.status, 'conversion'),
    };
  }

  if (record.kind === 'private') {
    const envelope = record.value;
    const isConversion = envelope.operationType === 'conversion';
    const rows = isConversion
      ? [
          { label: 'Private operation', value: record.operationId },
          ...(envelope.sourceAmountDisplay ? [{ label: 'You converted', value: envelope.sourceAmountDisplay }] : []),
          ...(envelope.targetAmountDisplay ? [{ label: 'You receive', value: envelope.targetAmountDisplay }] : []),
        ]
      : [
          { label: 'Private operation', value: record.operationId },
          {
            label: 'Recipient',
            value: envelope.recipientHandle ? `@${envelope.recipientHandle}` : envelope.recipientName ?? 'Private recipient',
          },
          ...(envelope.recipientWalletAddress
            ? [{ label: 'Destination', value: shortenAddress(envelope.recipientWalletAddress) }]
            : []),
          ...(envelope.purpose ? [{ label: 'Purpose', value: envelope.purpose }] : []),
        ];

    return {
      amount: envelope.amountDisplay ?? envelope.targetAmountDisplay ?? 'Private amount',
      assetCode: envelope.assetCode,
      canRepeat: false,
      date: formatLongDate(envelope.createdAt),
      icon: isConversion ? 'repeat' as const : 'arrow-up-right' as const,
      rows,
      status: envelope.status,
      subtitle: isConversion
        ? `Private conversion to ${envelope.targetAssetCode ?? envelope.assetCode}`
        : envelope.recipientHandle
          ? `Private transfer to @${envelope.recipientHandle}`
          : envelope.recipientName
            ? `Private transfer to ${envelope.recipientName}`
            : 'Private stablecoin transfer',
      timeline: ensureTimeline(undefined, envelope.status, isConversion ? 'private conversion' : 'private transfer'),
    };
  }

  const receipt = record.value;
  const isIncoming = receipt.railType === 'deposit';
  const assetCode = resolveReceiptAssetCode(receipt);
  const isStablecoinDeposit = isIncoming && isStablecoinCurrency(assetCode);
  const privateCreditSymbol = isStablecoinDeposit ? `c${assetCode}` : undefined;
  const privateCredit = record.privateCreditOperation
    ? formatPrivateCreditStatus(record.privateCreditOperation)
    : privateCreditSymbol
      ? `Awaiting ${privateCreditSymbol} privacy confirmation`
      : undefined;
  const amountDisplay = formatMoneyAmountWithAsset(receipt.amount, { assetCode });
  const amountLabel = isStablecoinDeposit ? 'Public amount received' : isIncoming ? 'You received' : 'You sent';
  const settlementDisplay = receipt.settlementAmount
    ? formatMoneyAmountWithAsset(receipt.settlementAmount, {
        assetCode: receipt.settlementAsset?.symbol ?? receipt.settlementAmount.currency,
      })
    : undefined;
  const icon = isIncoming ? 'arrow-down-left' : 'arrow-up-right';

  return {
    amount: amountDisplay,
    assetCode,
    canRepeat: !isIncoming,
    date: formatLongDate(receipt.createdAt),
    icon,
    rows: [
      { label: 'Asset', value: assetCode },
      { label: amountLabel, value: amountDisplay },
      { label: 'Payment channel', value: isStablecoinDeposit ? 'Public deposit' : titleCase(receipt.railType.replace(/_/g, ' ')) },
      ...(settlementDisplay ? [{ label: 'Settlement amount', value: settlementDisplay }] : []),
      ...(privateCredit ? [{ label: 'Private credit', value: privateCredit }] : []),
      { label: 'Reference code', value: receipt.reference },
    ],
    status: receipt.status,
    subtitle: isStablecoinDeposit
      ? `Public ${assetCode} received into Paayee`
      : isIncoming
        ? `${assetCode} received into Paayee`
        : `${assetCode} sent from Paayee`,
    timeline: ensureTimeline(receipt.timeline, receipt.status, receipt.railType),
  };
}

async function revealPrivateReceiptAmount(receipt: PaayeeReceipt): Promise<PaayeeReceipt> {
  if (receipt.receipt_type !== 'private_receive' || !receipt.encrypted_amount_handle || !receipt.token_symbol) {
    return receipt;
  }
  const tokenAddress = receipt.token_symbol === 'USDC'
    ? runtimeConfig.paayeeCusdcAddress
    : runtimeConfig.paayeeCusdtAddress;
  if (!tokenAddress) return receipt;
  try {
    const amount = await decryptPaayeeZamaEncryptedValue({
      chainId: runtimeConfig.zamaChainId,
      encryptedHandle: receipt.encrypted_amount_handle,
      tokenAddress,
    });
    return {
      ...receipt,
      amount_minor_units: amount.toString(),
      detail: 'Private transfer confirmed. This amount was decrypted only for your wallet.',
    };
  } catch (error) {
    if (__DEV__) console.warn('[paayee.private_receipt]', {
      message: error instanceof Error ? error.message : String(error),
      stage: 'transfer_amount_decrypt_failed',
    });
    return receipt;
  }
}

function ensureTimeline(
  timeline: KlydeTimelineItem[] | undefined,
  status: string,
  kind: string,
): KlydeTimelineItem[] {
  const normalizedStatus = status.toLowerCase();
  const isFailure = ['failed', 'expired', 'refunded', 'cancelled', 'reorged'].includes(normalizedStatus);
  const isSuccess = ['confirmed', 'settled', 'succeeded', 'completed'].includes(normalizedStatus);
  const terminal = isFailure || isSuccess;

  // Keep a provider timeline when it agrees with the receipt. A terminal
  // receipt must never retain a stale `current`/confirming step.
  if (timeline?.length && (!terminal || !timeline.some((item) => item.status === 'current'))) {
    return timeline;
  }

  const isConversion = kind.includes('conversion');
  const isDeposit = kind === 'deposit';
  const isShield = kind === 'shield';
  const isUnshield = kind === 'unshield';
  const processingTitle = isConversion
    ? 'Processing conversion'
    : isDeposit
      ? 'Confirming deposit'
      : isShield || isUnshield
        ? 'Confirming privacy update'
        : 'Processing payment';
  const processingDescription = isConversion
    ? 'We are confirming the conversion'
    : isDeposit
      ? 'We are waiting for the deposit to be confirmed onchain'
      : isShield
        ? 'We are confirming your private balance update'
        : isUnshield
          ? 'We are confirming your public balance update'
          : 'We are confirming this payment';
  const timelineItems: KlydeTimelineItem[] = [
    {
      step: `${kind}_initiated`,
      title: isConversion ? 'Conversion initiated' : 'Transaction initiated',
      status: 'completed',
    },
  ];

  if (!terminal) {
    timelineItems.push({
      step: `${kind}_processing`,
      title: processingTitle,
      description: processingDescription,
      status: 'current',
    });
    return timelineItems;
  }

  timelineItems.push(
    {
      step: isFailure ? `${kind}_failed` : `${kind}_complete`,
      title: isFailure ? failureTimelineTitle(kind) : successTimelineTitle(kind),
      description: isFailure ? undefined : successTimelineDescription(kind),
      status: isFailure ? 'failed' : 'completed',
    },
  );

  return timelineItems;
}

function successTimelineTitle(kind: string): string {
  if (kind.includes('conversion')) return 'Conversion complete';
  if (kind === 'deposit') return 'Deposit confirmed';
  if (kind === 'private_receive') return 'Private transfer received';
  if (kind === 'shield') return 'Money made private';
  if (kind === 'unshield') return 'Money moved to public';
  return 'Payment complete';
}

function successTimelineDescription(kind: string): string {
  if (kind === 'deposit') return 'The funds are available in your public balance';
  if (kind === 'private_receive') return 'Your private balance has been updated';
  if (kind === 'shield') return 'Your private balance has been updated';
  if (kind === 'unshield') return 'Your public balance has been updated';
  if (kind.includes('conversion')) return 'The converted funds are available';
  return 'This payment has been confirmed';
}

function failureTimelineTitle(kind: string): string {
  if (kind.includes('conversion')) return 'Conversion failed';
  if (kind === 'deposit') return 'Deposit not completed';
  if (kind === 'shield' || kind === 'unshield') return 'Privacy update failed';
  return 'Payment failed';
}

function isTerminalRecord(record: DetailRecord): boolean {
  if (record.kind === 'receipt' && record.privateCreditOperation) {
    return isTerminalPrivateCreditStatus(record.privateCreditOperation.status);
  }

  // A confirmed operation is still reconciled until its canonical receipt is
  // available. This keeps the same timeline alive instead of stranding the
  // user between an onchain confirmation and the worker-created receipt.
  if (record.kind === 'paayee-operation') {
    return record.value.status === 'failed';
  }

  const status = record.kind === 'conversion' ? record.value.status : record.value.status;

  return isTerminalStatus(status);
}

function isTerminalStatus(status: string): boolean {
  return ['confirmed', 'settled', 'succeeded', 'completed', 'failed', 'expired', 'refunded', 'cancelled'].includes(status);
}

function getStatusTone(status: string): 'error' | 'pending' | 'success' {
  if (['failed', 'expired', 'cancelled'].includes(status)) {
    return 'error';
  }

  if (isTerminalStatus(status)) {
    return 'success';
  }

  return 'pending';
}

function formatStatus(status: string): string {
  if (status === 'settled' || status === 'succeeded') {
    return 'Completed';
  }

  return titleCase(status.replace(/_/g, ' '));
}

function formatTimelineDescription(item: KlydeTimelineItem): string {
  if (item.status !== 'failed') {
    return item.description ?? '';
  }

  return 'We could not complete this conversion right now. Your funds have been returned.';
}

async function resolvePrivateCreditOperation(receipt: KlydeReceipt): Promise<KlydeConfidentialOperation | undefined> {
  const assetCode = resolveReceiptAssetCode(receipt);
  if (receipt.railType !== 'deposit' || !isStablecoinCurrency(assetCode)) {
    return undefined;
  }

  try {
    const operations = await listKlydeConfidentialOperations({ page: 1, pageSize: 50 });

    return operations.find((operation) => {
      if (operation.kind !== 'confidential_deposit') {
        return false;
      }

      const metadata = operation.metadata ?? {};
      const railId = typeof metadata.railId === 'string' ? metadata.railId : undefined;
      const sourceCurrency =
        typeof metadata.sourceCurrency === 'string' ? metadata.sourceCurrency.toUpperCase() : undefined;
      const targetUnderlyingSymbol =
        typeof metadata.targetUnderlyingSymbol === 'string' ? metadata.targetUnderlyingSymbol.toUpperCase() : undefined;

      return railId === receipt.railId || sourceCurrency === assetCode || targetUnderlyingSymbol === assetCode;
    });
  } catch {
    return undefined;
  }
}

function formatPrivateCreditStatus(operation: KlydeConfidentialOperation): string {
  const symbol = operation.symbol.toUpperCase();

  switch (operation.status) {
    case 'succeeded':
      return `${symbol} credited privately`;
    case 'submitted':
      return `${symbol} privacy transaction confirming`;
    case 'prepared':
      return `${symbol} privacy transaction pending`;
    case 'failed':
      return `${symbol} privacy transaction needs attention`;
  }
}

function isTerminalPrivateCreditStatus(status: KlydeConfidentialOperation['status']): boolean {
  return status === 'succeeded' || status === 'failed';
}

function formatMoneyAmount(amount: MoneyAmount): string {
  const numericAmount = parseMoneyAmount(amount);
  const symbol = getCurrencySymbol(amount.currency);

  if (Number.isFinite(numericAmount)) {
    return `${symbol}${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
    }).format(numericAmount)}`;
  }

  return `${symbol}${amount.display}`;
}

function formatMoneyAmountWithAsset(amount: MoneyAmount, options: { assetCode?: string } = {}): string {
  const formatted = formatMoneyAmount(amount);
  const assetCode = (options.assetCode ?? amount.currency).toUpperCase();

  if (isStablecoinCurrency(assetCode)) {
    return `${formatted} ${assetCode}`;
  }

  return formatted;
}

function resolveReceiptAssetCode(receipt: KlydeReceipt): string {
  return (receipt.settlementAsset?.symbol ?? receipt.amount.currency).toUpperCase();
}

function getAssetBadgeText(assetCode: string): string {
  const normalized = assetCode.toUpperCase();

  if (normalized === 'NGN') {
    return '₦';
  }

  if (normalized === 'USDC') {
    return 'C';
  }

  if (normalized === 'USDT') {
    return 'T';
  }

  return normalized.slice(0, 1);
}

function parseMoneyAmount(amount: MoneyAmount): number {
  if (amount.minorUnits && amount.scale !== undefined) {
    return Number(amount.minorUnits) / 10 ** amount.scale;
  }

  return Number(amount.display.replace(/,/g, ''));
}

function getCurrencySymbol(currency: string): string {
  if (currency.toUpperCase() === 'NGN') {
    return '₦';
  }

  if (['USD', 'USDC', 'USDT'].includes(currency.toUpperCase())) {
    return '$';
  }

  return `${currency.toUpperCase()} `;
}

function isStablecoinCurrency(currency: string): boolean {
  const normalized = currency.toUpperCase();

  return normalized === 'USDC' || normalized === 'USDT';
}

function formatLongDate(value?: string): string {
  if (!value) {
    return 'Pending';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Pending';
  }

  const day = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${day} | ${time}`;
}

function shortenAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function stripPaayeeActivityPrefix(value: string): string {
  return value.replace(/^(operation|deposit|private-transfer):/, '');
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
