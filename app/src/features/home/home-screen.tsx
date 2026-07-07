import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import UsdcLogo from '../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../assets/icons/usdt.svg';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/theme';
import { useAppData, type AppBalance } from '@/features/app-data';
import { styles } from './home-screen.styles';

const nigeriaFlag = require('../../../assets/images/nigeria.png');

const quickActions = [
  { label: 'Add money', icon: 'plus', route: '/add-money' },
  { label: 'Send', icon: 'arrow-up-right', route: '/send' },
  { label: 'Chat', icon: 'message-circle', comingSoon: true },
] as const;
const homeTransactionLimit = 3;

export function HomeScreen() {
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [balanceRevealLoading, setBalanceRevealLoading] = useState(false);
  const { data, loading, refresh } = useAppData();
  const latestSeenActivityId = useRef<string | undefined>(undefined);
  const router = useRouter();
  const balances = data?.balances ?? [];
  const transactions = data?.transactions ?? [];
  const recentTransactions = transactions.slice(0, homeTransactionLimit);
  const latestActivityId = transactions[0]?.id;
  const totalDisplay = formatPrivateBalanceDisplay(data?.totalDisplay ?? '₦0.00', balanceVisible, 'total');

  useEffect(() => {
    if (!latestActivityId) {
      return;
    }

    if (!latestSeenActivityId.current) {
      latestSeenActivityId.current = latestActivityId;
      return;
    }

    if (latestSeenActivityId.current !== latestActivityId) {
      latestSeenActivityId.current = latestActivityId;
      setBalanceVisible(false);
    }
  }, [latestActivityId]);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.shell}>
            <FadeInView style={styles.header}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Open your profile"
                onPress={() => router.push('/profile/details' as Href)}
                style={styles.identity}>
                {loading ? <SkeletonBlock style={styles.avatarSkeleton} /> : <Avatar initials={data?.profile.initials ?? 'PY'} />}
              </PressableScale>

              <View style={styles.headerActions}>
                <PressableScale style={[styles.iconButton, styles.iconButtonTint]}>
                  <Feather name="bell" size={18} color={Colors.light.black} />
                </PressableScale>
              </View>
            </FadeInView>

            {loading ? (
              <HomeLoadingState />
            ) : (
              <FadeInView delay={60} style={styles.balanceBlock}>
                <Text style={styles.balancePill}>Total private balance</Text>
                <View style={styles.balanceRow}>
                  {balanceRevealLoading && balanceVisible ? (
                    <SkeletonBlock style={styles.balanceAmountSkeleton} />
                  ) : balanceVisible ? (
                    <Text style={styles.balance}>
                      {totalDisplay}
                    </Text>
                  ) : (
                    <Text style={styles.balanceHidden}>{totalDisplay}</Text>
                  )}
                  <Pressable
                    onPress={async () => {
                      if (balanceVisible) {
                        setBalanceVisible(false);
                        return;
                      }

                      setBalanceVisible(true);
                      setBalanceRevealLoading(true);
                      try {
                        await refresh({ silent: true });
                      } finally {
                        setBalanceRevealLoading(false);
                      }
                    }}
                    style={styles.balanceToggle}
                    accessibilityRole="button"
                    accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}>
                    <Feather
                      name={balanceVisible ? 'eye-off' : 'eye'}
                      size={17}
                      color={Colors.light.primary}
                    />
                  </Pressable>
                </View>
              </FadeInView>
            )}

            <FadeInView delay={110} style={styles.cardStage}>
              <View style={styles.backCard} />
              <View style={styles.paymentCard}>
                <View style={styles.cardRibbonOne} />
                <View style={styles.cardRibbonTwo} />
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardBrand}>paayee</Text>
                  <View style={styles.cardDots}>
                    <View style={styles.dotRed} />
                    <View style={styles.dotYellow} />
                  </View>
                </View>
                {/* <View style={styles.cardSignal}>
                  <Feather name="wifi" size={22} color="rgba(255,255,255,0.64)" />
                </View> */}
              </View>
            </FadeInView>

            <FadeInView delay={160} style={styles.quickActions}>
              {quickActions.map((action) => {
                const comingSoon = 'comingSoon' in action && action.comingSoon;

                return (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ disabled: comingSoon }}
                    disabled={comingSoon}
                    key={action.label}
                    onPress={
                      'route' in action
                        ? () => router.push(action.route as Href)
                        : undefined
                    }
                    style={[styles.actionItem, comingSoon && styles.actionItemDisabled]}>
                    <View style={[styles.actionIcon, comingSoon && styles.actionIconDisabled]}>
                      <Feather
                        name={action.icon}
                        size={24}
                        color={comingSoon ? Colors.light.textTertiary : Colors.light.black}
                      />
                    </View>
                    <Text style={[styles.actionLabel, comingSoon && styles.actionLabelDisabled]}>
                      {action.label}
                    </Text>
                    {comingSoon ? <Text style={styles.actionComingSoon}>Coming soon</Text> : null}
                  </PressableScale>
                );
              })}
            </FadeInView>

            <FadeInView delay={210} style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Your balances</Text>
            </FadeInView>

            <FadeInView delay={240}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.balanceCardsContent}
                style={styles.balanceCards}>
                {loading ? (
                  <BalanceCardsLoading />
                ) : (
                  balances.map((asset) => (
                    <PressableScale
                      key={asset.code}
                      onPress={() => router.push(`/asset/${asset.code.toLowerCase()}` as Href)}
                      style={styles.balanceCard}>
                      <BalanceCardHeader asset={asset} />
                      {balanceRevealLoading && balanceVisible ? (
                        <SkeletonBlock style={styles.balanceCardAmountSkeleton} />
                      ) : (
                        <Text style={styles.balanceCardAmount}>
                          {formatPrivateBalanceDisplay(asset.displayAmount, balanceVisible, 'asset')}
                        </Text>
                      )}
                      <Text style={styles.balanceCardLabel}>{asset.label}</Text>
                    </PressableScale>
                  ))
                )}
              </ScrollView>
            </FadeInView>

            <FadeInView delay={280} style={styles.recentHeader}>
              <Text style={styles.sectionEyebrow}>Recent transactions</Text>
              {transactions.length > homeTransactionLimit ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="See all transactions"
                  onPress={() => router.push('/transactions' as Href)}
                  style={styles.seeAllButton}>
                  <Text style={styles.seeAll}>See all</Text>
                </PressableScale>
              ) : null}
            </FadeInView>

            <FadeInView delay={310} style={styles.activityList}>
              {recentTransactions.length ? (
                recentTransactions.map((item) => (
                <PressableScale
                  key={item.id}
                  onPress={() => {
                    const receiptParam = item.receiptId
                      ? `&receiptId=${encodeURIComponent(item.receiptId)}`
                      : '';
                    const privateEnvelopeParam = item.privateEnvelopeId
                      ? `&privateEnvelopeId=${encodeURIComponent(item.privateEnvelopeId)}`
                      : '';

                    router.push(
                      `/transaction/${encodeURIComponent(item.id)}?kind=${item.kind}${receiptParam}${privateEnvelopeParam}` as Href,
                    );
                  }}
                  style={styles.activityRow}>
                  <View style={styles.activityAvatar}>
                    <Text style={styles.activityInitial}>
                      {(item.initials ?? item.title.slice(0, 1)).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.activityCopy}>
                    <Text numberOfLines={1} style={styles.activityName}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.activityDetail}>{item.detail}</Text>
                  </View>
                  <Text
                    style={[
                      styles.activityAmount,
                      item.amount.startsWith('+') && styles.activityAmountPositive,
                      item.amount.startsWith('-') && styles.activityAmountNegative,
                    ]}>
                    {item.amount}
                  </Text>
                </PressableScale>
                ))
              ) : (
                <EmptyActivityState />
              )}
            </FadeInView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatPrivateBalanceDisplay(
  value: string,
  visible: boolean,
  surface: 'asset' | 'total',
): string {
  if (!visible) {
    return surface === 'total' ? '••••••' : '••••';
  }

  return stripMaskedCurrencySymbol(value);
}

function stripMaskedCurrencySymbol(value: string): string {
  if (!value.includes('••••')) {
    return value;
  }

  return value.replace(/^[₦$]\s*/, '');
}

function BalanceCardHeader({ asset }: { asset: AppBalance }) {
  return (
    <View style={styles.balanceCardHeader}>
      <View style={styles.assetOrb}>
        {asset.icon === 'ngn' ? (
          <Image source={nigeriaFlag} style={styles.assetImage} />
        ) : asset.icon === 'usdc' ? (
          <UsdcLogo width={42} height={42} />
        ) : (
          <UsdtLogo width={42} height={42} />
        )}
      </View>
      <View>
        <Text style={styles.balanceCardName}>{asset.name}</Text>
        <Text style={styles.balanceCardCode}>{asset.code}</Text>
      </View>
    </View>
  );
}

function HomeLoadingState() {
  return (
    <FadeInView delay={60} style={styles.balanceBlock}>
      <SkeletonBlock style={styles.balancePillSkeleton} />
      <SkeletonBlock style={styles.balanceAmountSkeleton} />
    </FadeInView>
  );
}

function BalanceCardsLoading() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.balanceCard}>
          <View style={styles.balanceCardHeader}>
            <SkeletonBlock style={styles.balanceCardIconSkeleton} />
            <View>
              <SkeletonBlock style={styles.balanceCardNameSkeleton} />
              <SkeletonBlock style={styles.balanceCardCodeSkeleton} />
            </View>
          </View>
          <SkeletonBlock style={styles.balanceCardAmountSkeleton} />
          <SkeletonBlock style={styles.balanceCardLabelSkeleton} />
        </View>
      ))}
    </>
  );
}

function EmptyActivityState() {
  return (
    <View style={styles.emptyActivity}>
      <View style={styles.emptyActivityIcon}>
        <Feather name="activity" size={20} color={Colors.light.textSecondary} />
      </View>
      <View style={styles.activityCopy}>
        <Text style={styles.activityName}>No transactions yet</Text>
        <Text style={styles.activityDetail}>Your first deposit or send will appear here.</Text>
      </View>
    </View>
  );
}
