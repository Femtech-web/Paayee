import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import UsdcLogo from '../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../assets/icons/usdt.svg';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/theme';
import { styles } from './home-screen.styles';

const nigeriaFlag = require('../../../assets/images/nigeria.png');

const assets = [
  {
    code: 'NGN',
    name: 'Nigerian Naira',
    label: 'Klyde sandbox rail',
    amount: '₦2,850,000',
    icon: 'ngn',
  },
  {
    code: 'USDC',
    name: 'USD Coin',
    label: 'Private dollar balance',
    amount: '$4,280.40',
    icon: 'usdc',
  },
  {
    code: 'USDT',
    name: 'Tether USD',
    label: 'Private tether balance',
    amount: '$1,840.00',
    icon: 'usdt',
  },
] as const;

const quickActions = [
  { label: 'Add money', icon: 'plus' },
  { label: 'Send', icon: 'arrow-up-right' },
  { label: 'Chat', icon: 'message-circle' },
] as const;

const recentTransactions = [
  { name: 'Ada Lin', detail: 'Private receipt ready', amount: '-200 USDC' },
  { name: 'Klyde funding', detail: 'NGN rail confirmed', amount: '+50,000 NGN' },
  { name: '0x7B8...42F1', detail: 'Recipient decrypted', amount: '-85 USDT' },
];

export function HomeScreen() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.shell}>
            <FadeInView style={styles.header}>
              <View style={styles.identity}>
                <Avatar initials="jd" />
              </View>

              <View style={styles.headerActions}>
                <PressableScale style={[styles.iconButton, styles.iconButtonTint]}>
                  <Feather name="bell" size={18} color={Colors.light.black} />
                </PressableScale>
              </View>
            </FadeInView>

            <FadeInView delay={60} style={styles.balanceBlock}>
              <Text style={styles.balancePill}>Private balance</Text>
              <View style={styles.balanceRow}>
                {balanceVisible ? (
                  <Text style={styles.balance}>
                    <Text style={styles.balanceCurrency}>$</Text>
                    4,280
                    <Text style={styles.balanceDecimal}>.40</Text>
                  </Text>
                ) : (
                  <Text style={styles.balanceHidden}>••••••</Text>
                )}
                <Pressable
                  onPress={() => setBalanceVisible((visible) => !visible)}
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
              {quickActions.map((action) => (
                <PressableScale
                  key={action.label}
                  onPress={
                    action.label === 'Send'
                      ? () => router.push('/send' as Href)
                      : action.label === 'Add money'
                        ? () => router.push('/add-money' as Href)
                        : undefined
                  }
                  style={styles.actionItem}>
                  <View style={styles.actionIcon}>
                    <Feather name={action.icon} size={24} color={Colors.light.black} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </PressableScale>
              ))}
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
                {assets.map((asset) => (
                  <PressableScale
                    key={asset.code}
                    onPress={() => router.push(`/asset/${asset.code.toLowerCase()}` as Href)}
                    style={styles.balanceCard}>
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
                    <Text style={styles.balanceCardAmount}>
                      {balanceVisible ? asset.amount : '••••'}
                    </Text>
                    <Text style={styles.balanceCardLabel}>{asset.label}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </FadeInView>

            <FadeInView delay={280} style={styles.recentHeader}>
              <Text style={styles.sectionEyebrow}>Recent transactions</Text>
              <Text style={styles.seeAll}>See all</Text>
            </FadeInView>

            <FadeInView delay={310} style={styles.activityList}>
              {recentTransactions.map((item) => (
                <View key={`${item.name}-${item.amount}`} style={styles.activityRow}>
                  <View style={styles.activityAvatar}>
                    <Text style={styles.activityInitial}>{item.name.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityName}>{item.name}</Text>
                    <Text style={styles.activityDetail}>{item.detail}</Text>
                  </View>
                  <Text
                    style={[
                      styles.activityAmount,
                      item.amount.startsWith('+') && styles.activityAmountPositive,
                      item.amount.startsWith('-') && styles.activityAmountNegative,
                    ]}>
                    {item.amount}
                  </Text>
                </View>
              ))}
            </FadeInView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
