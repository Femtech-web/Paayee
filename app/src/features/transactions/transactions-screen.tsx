import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import { useAppData, type AppTransaction } from '@/features/app-data';
import { styles } from './transactions-screen.styles';

const INITIAL_VISIBLE_TRANSACTIONS = 10;

function TransactionAvatar({ transaction }: { transaction: AppTransaction }) {
  if (transaction.initials) {
    return <Avatar initials={transaction.initials} size={52} />;
  }

  return (
    <View style={styles.transactionIcon}>
      <Feather name={transaction.icon ?? 'trending-up'} size={20} color={Colors.light.black} />
    </View>
  );
}

export function TransactionsScreen() {
  const router = useRouter();
  const { data, loading } = useAppData();
  const transactions = data?.transactions ?? [];
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_TRANSACTIONS);
  const visibleTransactions = transactions.slice(0, visibleCount);
  const canLoadMore = transactions.length > visibleTransactions.length;

  return (
    <Screen contentStyle={styles.content}>
      <FadeInView style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <PressableScale style={styles.insightButton}>
          <Feather name="pie-chart" size={18} color={Colors.light.primary} />
          <Text style={styles.insightText}>Privacy insight</Text>
        </PressableScale>
      </FadeInView>

      <FadeInView delay={60} style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={21} color={Colors.light.textTertiary} />
          <TextInput
            editable={false}
            placeholder="Search transactions"
            placeholderTextColor={Colors.light.textTertiary}
            style={styles.searchInput}
          />
        </View>
        <PressableScale style={styles.filterButton}>
          <Feather name="sliders" size={19} color={Colors.light.black} />
        </PressableScale>
      </FadeInView>

      <FadeInView delay={110} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>All transactions</Text>
        <View style={styles.sectionLine} />
      </FadeInView>

      <View style={styles.transactionList}>
        {loading ? (
          <TransactionsSkeleton />
        ) : visibleTransactions.length ? (
          visibleTransactions.map((transaction, index) => (
            <TransactionRow
              key={transaction.id}
              index={index}
              onPress={() => {
                const receiptParam = transaction.receiptId
                  ? `&receiptId=${encodeURIComponent(transaction.receiptId)}`
                  : '';
                const privateEnvelopeParam = transaction.privateEnvelopeId
                  ? `&privateEnvelopeId=${encodeURIComponent(transaction.privateEnvelopeId)}`
                  : '';

                router.push(
                  `/transaction/${encodeURIComponent(transaction.id)}?kind=${transaction.kind}${receiptParam}${privateEnvelopeParam}` as Href,
                );
              }}
              transaction={transaction}
            />
          ))
        ) : (
          <EmptyTransactionsState />
        )}
      </View>

      {canLoadMore ? (
        <FadeInView delay={410}>
          <PressableScale
            onPress={() => setVisibleCount((count) => count + INITIAL_VISIBLE_TRANSACTIONS)}
            style={styles.loadMoreButton}>
            <Text style={styles.loadMoreText}>Load more</Text>
          </PressableScale>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

function TransactionRow({
  index,
  onPress,
  transaction,
}: {
  index: number;
  onPress: () => void;
  transaction: AppTransaction;
}) {
  return (
    <FadeInView delay={140 + index * 26}>
      <PressableScale onPress={onPress} style={styles.transactionRow}>
        <TransactionAvatar transaction={transaction} />
        <View style={styles.transactionCopy}>
          <Text numberOfLines={1} style={styles.transactionTitle}>
            {transaction.title}
          </Text>
          <Text numberOfLines={1} style={styles.transactionDetail}>
            {transaction.detail} · {transaction.when}
          </Text>
        </View>
        <View style={styles.amountBlock}>
          <Text
            numberOfLines={1}
            style={[
              styles.transactionAmount,
              transaction.tone === 'positive' && styles.amountPositive,
              transaction.tone === 'negative' && styles.amountNegative,
              transaction.tone === 'receipt' && styles.amountReceipt,
            ]}>
            {transaction.amount}
          </Text>
          {transaction.secondaryAmount ? (
            <Text numberOfLines={1} style={styles.secondaryAmount}>
              {transaction.secondaryAmount}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={19} color={Colors.light.textTertiary} />
      </PressableScale>
    </FadeInView>
  );
}

function TransactionsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.transactionRow}>
          <SkeletonBlock style={styles.rowAvatarSkeleton} />
          <View style={styles.transactionCopy}>
            <SkeletonBlock style={styles.rowTitleSkeleton} />
            <SkeletonBlock style={styles.rowSubtitleSkeleton} />
          </View>
          <SkeletonBlock style={styles.rowAmountSkeleton} />
        </View>
      ))}
    </>
  );
}

function EmptyTransactionsState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="credit-card" size={24} color={Colors.light.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptyText}>
        Add money, send to a recipient, or convert a balance and your history will appear here.
      </Text>
    </View>
  );
}
