import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/loading/skeleton';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import {
  getKlydeConversion,
  getKlydeReceipt,
  listKlydeTransactions,
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
      transaction?: KlydeTransaction;
      value: KlydeReceipt;
    };

export function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    receiptId?: string;
    returnTo?: string;
    transactionId?: string;
  }>();
  const transactionId = readParam(params.transactionId);
  const receiptId = readParam(params.receiptId);
  const kind = readParam(params.kind);
  const returnTo = readParam(params.returnTo);
  const [record, setRecord] = useState<DetailRecord>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

      if (receiptId) {
        const receipt = await getKlydeReceipt({ receiptId });
        setRecord({ kind: 'receipt', value: receipt });
        return;
      }

      const transactions = await listKlydeTransactions({ page: 1, pageSize: 50 });
      const transaction = transactions.data.find(
        (item) => item.id === transactionId || item.receiptId === transactionId,
      );

      if (transaction) {
        setRecord({ kind: 'receipt', transaction, value: transaction.receipt });
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
  }, [kind, receiptId, transactionId]);

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
                  <Text style={styles.assetDotText}>{display.assetCode.slice(0, 1)}</Text>
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
                    <Text selectable numberOfLines={2} style={styles.detailValue}>
                      {row.value}
                    </Text>
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
  const tone = item.status === 'failed' ? 'error' : item.status === 'current' ? 'pending' : 'success';

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
            name={item.status === 'failed' ? 'x' : item.status === 'current' ? 'clock' : 'check'}
            size={15}
            color={Colors.light.white}
          />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.timelineText}>{item.description}</Text> : null}
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
  rows: { label: string; value: string }[];
  status: string;
  subtitle: string;
  timeline: KlydeTimelineItem[];
} {
  if (record.kind === 'conversion') {
    const conversion = record.value;

    return {
      amount: formatMoneyAmount(conversion.targetAmount),
      assetCode: conversion.targetAmount.currency,
      canRepeat: false,
      date: formatLongDate(conversion.createdAt),
      icon: 'repeat' as const,
      rows: [
        { label: 'You received', value: formatMoneyAmount(conversion.targetAmount) },
        { label: 'You converted', value: formatMoneyAmount(conversion.sourceAmount) },
        ...(conversion.rateReference ? [{ label: 'Rate reference', value: conversion.rateReference }] : []),
      ],
      status: conversion.status,
      subtitle: `Converted to ${conversion.targetAmount.currency}`,
      timeline: ensureTimeline(conversion.timeline, conversion.status, 'conversion'),
    };
  }

  const receipt = record.value;
  const isIncoming = receipt.railType === 'deposit';
  const icon = isIncoming ? 'arrow-down-left' : 'arrow-up-right';

  return {
    amount: formatMoneyAmount(receipt.amount),
    assetCode: receipt.amount.currency,
    canRepeat: !isIncoming,
    date: formatLongDate(receipt.createdAt),
    icon,
    rows: [
      { label: isIncoming ? 'You received' : 'You sent', value: formatMoneyAmount(receipt.amount) },
      { label: 'Payment channel', value: titleCase(receipt.railType.replace(/_/g, ' ')) },
      ...(receipt.settlementAmount
        ? [{ label: 'Settlement amount', value: formatMoneyAmount(receipt.settlementAmount) }]
        : []),
      { label: 'Reference code', value: receipt.reference },
    ],
    status: receipt.status,
    subtitle: isIncoming ? 'Received into Paayee' : 'Sent from Paayee',
    timeline: ensureTimeline(receipt.timeline, receipt.status, receipt.railType),
  };
}

function ensureTimeline(
  timeline: KlydeTimelineItem[] | undefined,
  status: string,
  kind: string,
): KlydeTimelineItem[] {
  if (timeline?.length) {
    return timeline;
  }

  const terminalStatus = isTerminalStatus(status) ? 'completed' : 'current';

  return [
    {
      step: `${kind}_initiated`,
      title: kind === 'conversion' ? 'Conversion initiated' : 'Transaction initiated',
      status: 'completed',
    },
    {
      step: `${kind}_processing`,
      title: kind === 'conversion' ? 'Processing conversion' : 'Processing payment',
      status: terminalStatus,
    },
    {
      step: `${kind}_complete`,
      title: kind === 'conversion' ? 'Conversion complete' : 'Payment complete',
      status: isTerminalStatus(status) ? 'completed' : 'pending',
    },
  ];
}

function isTerminalRecord(record: DetailRecord): boolean {
  const status = record.kind === 'conversion' ? record.value.status : record.value.status;

  return isTerminalStatus(status);
}

function isTerminalStatus(status: string): boolean {
  return ['settled', 'succeeded', 'completed', 'failed', 'expired', 'refunded', 'cancelled'].includes(status);
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

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
