import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import UsdcLogo from '../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../assets/icons/usdt.svg';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { assetDetails, type AssetCode } from './asset-data';
import { styles } from './asset-detail-screen.styles';

const nigeriaFlag = require('../../../assets/images/nigeria.png');

type AssetDetailScreenProps = {
  assetCode: AssetCode;
};

const qrCells = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return row === 0 || col === 0 || row === 8 || col === 8 || (row + col) % 3 === 0 || row === col;
});

export function AssetDetailScreen({ assetCode }: AssetDetailScreenProps) {
  const router = useRouter();
  const asset = assetDetails[assetCode];
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.shell}>
            <FadeInView style={styles.topBar}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                style={styles.roundButton}>
                <Feather name="chevron-left" size={26} color={Colors.light.black} />
              </PressableScale>

              <View style={styles.topBarSpacer} />
            </FadeInView>

            <FadeInView delay={60} style={styles.hero}>
              <View style={styles.assetHeroIcon}>
                <AssetIcon code={asset.code} large />
              </View>
              <Text style={styles.balanceLabel}>{asset.balanceLabel}</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balance}>{balanceVisible ? asset.balance : '••••••'}</Text>
                <Pressable
                  onPress={() => setBalanceVisible((isVisible) => !isVisible)}
                  style={styles.visibilityButton}
                  accessibilityRole="button"
                  accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}>
                  <Feather name={balanceVisible ? 'eye-off' : 'eye'} size={18} color="#4B83FF" />
                </Pressable>
              </View>
              <View style={styles.actionRow}>
                <PressableScale
                  onPress={() => router.push(`/add-money?asset=${asset.displayCode}` as Href)}
                  style={styles.actionPill}>
                  <Feather name="plus" size={20} color={Colors.light.black} />
                  <Text style={styles.actionText}>Add</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => router.push('/send' as Href)}
                  style={styles.actionPill}>
                  <Feather name="arrow-up-right" size={20} color={Colors.light.black} />
                  <Text style={styles.actionText}>Send</Text>
                </PressableScale>
                <PressableScale style={styles.actionPill}>
                  <Feather name="refresh-cw" size={20} color={Colors.light.black} />
                  <Text style={styles.actionText}>Convert</Text>
                </PressableScale>
              </View>
            </FadeInView>

            <View style={styles.divider} />

            {asset.code === 'ngn' ? <NgnReceivePanel /> : <StablecoinReceivePanel assetCode={asset.code} />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AssetIcon({ code, large = false }: { code: AssetCode; large?: boolean }) {
  const size = large ? 52 : 42;

  if (code === 'ngn') {
    return <Image source={nigeriaFlag} style={[styles.assetImage, { width: size, height: size }]} />;
  }

  if (code === 'usdc') {
    return <UsdcLogo width={size} height={size} />;
  }

  return <UsdtLogo width={size} height={size} />;
}

function NgnReceivePanel() {
  const router = useRouter();

  return (
    <FadeInView delay={120} style={styles.receiveSection}>
      <View>
        <Text style={styles.receiveTitle}>Receive NGN</Text>
        <Text style={styles.receiveSubtitle}>Add money to your Paayee NGN balance</Text>
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeIcon}>
          <Feather name="info" size={18} color={Colors.light.primary} />
        </View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Funding route</Text>
          <Text style={styles.noticeText}>
            Paayee shows payment instructions and tracks deposit status while keeping the
            product experience simple.
          </Text>
        </View>
      </View>

      <PressableScale
        onPress={() => router.push('/asset/ngn/account-details' as Href)}
        style={styles.ngnSetupCard}>
        <View style={styles.ngnSetupCopy}>
          <Text style={styles.ngnSetupTitle}>Set up NGN funding</Text>
          <Text style={styles.ngnSetupText}>
            Get a dedicated payment reference for funding your Paayee NGN balance.
          </Text>
          <View style={styles.primaryMiniButton}>
            <Text style={styles.primaryMiniButtonText}>Get instructions</Text>
            <Feather name="chevron-right" size={17} color={Colors.light.white} />
          </View>
        </View>
        <View style={styles.bankIllustration}>
          <View style={styles.bankRoof} />
          <View style={styles.bankColumns}>
            <View style={styles.bankColumn} />
            <View style={styles.bankColumn} />
            <View style={styles.bankColumn} />
          </View>
          <View style={styles.bankBase} />
        </View>
      </PressableScale>
    </FadeInView>
  );
}

function StablecoinReceivePanel({ assetCode }: { assetCode: Extract<AssetCode, 'usdc' | 'usdt'> }) {
  const asset = assetDetails[assetCode];

  return (
    <FadeInView delay={120} style={styles.receiveSection}>
      <View>
        <Text style={styles.receiveTitle}>{asset.receiveTitle}</Text>
        <Text style={styles.receiveSubtitle}>{asset.receiveSubtitle}</Text>
      </View>

      <View style={styles.networkRow}>
        {asset.networks?.map((network) => (
          <PressableScale
            key={network.label}
            style={[styles.networkPill, network.selected && styles.networkPillActive]}>
            <Feather
              name="link"
              size={17}
              color={network.selected ? '#4B83FF' : Colors.light.textSecondary}
            />
            <Text style={[styles.networkText, network.selected && styles.networkTextActive]}>
              {network.label}
            </Text>
          </PressableScale>
        ))}
      </View>

      <View style={styles.qrCard}>
        <View style={styles.qrBox}>
          {qrCells.map((filled, index) => (
            <View key={index} style={[styles.qrCell, filled && styles.qrCellFilled]} />
          ))}
          <View style={styles.qrLogo}>
            <Feather name="link-2" size={22} color={Colors.light.black} />
          </View>
        </View>

        <Text selectable style={styles.addressText}>
          {asset.address}
        </Text>

        <View style={styles.copyRow}>
          <View style={styles.copyButtonSlot}>
            <PressableScale style={styles.secondaryButton}>
              <Text numberOfLines={1} style={styles.secondaryButtonText}>
                Copy
              </Text>
              <Feather name="copy" size={16} color="#4B83FF" />
            </PressableScale>
          </View>
          <View style={styles.copyButtonSlot}>
            <PressableScale style={styles.secondaryButton}>
              <Text numberOfLines={1} style={styles.secondaryButtonText}>
                Share via
              </Text>
              <Feather name="share" size={16} color="#4B83FF" />
            </PressableScale>
          </View>
        </View>

        <Text style={styles.depositNote}>{asset.depositNote}</Text>
      </View>
    </FadeInView>
  );
}
