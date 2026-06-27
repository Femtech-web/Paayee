import { Feather } from '@react-native-vector-icons/feather';
import { Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import { styles } from './transactions-screen.styles';

type Transaction = {
  amount: string;
  detail: string;
  icon?: 'arrow-down-left' | 'eye' | 'repeat' | 'shield' | 'trending-up';
  initials?: string;
  secondaryAmount?: string;
  title: string;
  tone?: 'negative' | 'positive' | 'receipt';
  when: string;
};

const transactions: Transaction[] = [
  {
    initials: 'al',
    title: 'Ada Lin',
    detail: 'Private receipt ready',
    amount: '-200 USDC',
    tone: 'negative',
    when: 'Today',
  },
  {
    icon: 'repeat',
    title: 'NGN to USDC',
    detail: 'Klyde rail settled',
    amount: '$909.46',
    secondaryAmount: '₦1,246,160.45',
    when: 'Today',
  },
  {
    icon: 'shield',
    title: 'USDC private send',
    detail: 'Encrypted transfer',
    amount: '-USDC 200.00',
    tone: 'negative',
    when: '24 June 2026',
  },
  {
    initials: 'ud',
    title: 'USDC deposit',
    detail: 'Received privately',
    amount: '+USDC 911.28',
    tone: 'positive',
    when: '24 June 2026',
  },
  {
    initials: 'ao',
    title: 'Akolade Adeyemi',
    detail: 'NGN sandbox payout',
    amount: '-₦50,000',
    tone: 'negative',
    when: '14 June 2026',
  },
  {
    initials: 'to',
    title: 'Tobi Okoro',
    detail: 'Voice send confirmed',
    amount: '-₦12,035',
    tone: 'negative',
    when: '3 June 2026',
  },
  {
    initials: 'mk',
    title: 'Mina K',
    detail: 'Recipient decrypted',
    amount: '-85 USDT',
    tone: 'negative',
    when: '3 June 2026',
  },
  {
    icon: 'eye',
    title: 'Selective reveal',
    detail: 'Receipt proof opened',
    amount: 'Receipt',
    tone: 'receipt',
    when: '2 June 2026',
  },
];

function TransactionAvatar({ transaction }: { transaction: Transaction }) {
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
        {transactions.map((transaction, index) => (
          <FadeInView
            delay={140 + index * 26}
            key={`${transaction.title}-${transaction.amount}-${transaction.when}`}
            style={styles.transactionRow}>
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
          </FadeInView>
        ))}
      </View>

      <FadeInView delay={410}>
        <PressableScale style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </PressableScale>
      </FadeInView>
    </Screen>
  );
}
