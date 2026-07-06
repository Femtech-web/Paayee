import { Feather } from '@react-native-vector-icons/feather';
import * as Clipboard from 'expo-clipboard';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackToast } from '@/components/feedback-toast';
import UsdcLogo from '../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../assets/icons/usdt.svg';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { runtimeConfig } from '@/config/runtime';
import { FundingQrCode } from '@/features/add-money/components/funding-qr-code';
import { useAppData } from '@/features/app-data';
import {
  getKlydeFundingInstructions,
  listKlydeTransactions,
  type KlydeFundingInstructions,
} from '@/integrations/klyde';
import { splitAddress } from '../add-money/components/add-money-ui';
import { assetDetails, type AssetCode } from './asset-data';
import { styles } from './asset-detail-screen.styles';

const nigeriaFlag = require('../../../assets/images/nigeria.png');

type AssetDetailScreenProps = {
  assetCode: AssetCode;
};

export function AssetDetailScreen({ assetCode }: AssetDetailScreenProps) {
  const router = useRouter();
  const asset = assetDetails[assetCode];
  const { data, loading, refresh } = useAppData();
  const liveBalance = data?.balances.find(
    (balance) => balance.code.toLowerCase() === assetCode,
  );
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [balanceRevealLoading, setBalanceRevealLoading] = useState(false);
  const latestSeenActivityId = useRef<string | undefined>(undefined);
  const latestActivityId = data?.transactions[0]?.id;
  const displayBalance = liveBalance?.displayAmount ?? asset.balance;
  const privateBalanceDisplay = formatPrivateBalanceDisplay(displayBalance, balanceVisible);
  const displayName = liveBalance?.name ?? asset.balanceLabel;
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => setToastMessage(''), 3500);

    return () => clearTimeout(timeout);
  }, [toastMessage]);

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
              <Text style={styles.balanceLabel}>{displayName}</Text>
              <View style={styles.balanceRow}>
                {loading || (balanceRevealLoading && balanceVisible) ? (
                  <SkeletonBlock style={styles.balanceSkeleton} />
                ) : (
                  <Text style={styles.balance}>{privateBalanceDisplay}</Text>
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
                  style={styles.visibilityButton}
                  accessibilityRole="button"
                  accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}>
                  <Feather name={balanceVisible ? 'eye-off' : 'eye'} size={18} color="#4B83FF" />
                </Pressable>
              </View>
              <View style={styles.actionRow}>
                <PressableScale
                  onPress={() => router.push('/send' as Href)}
                  style={styles.actionPill}>
                  <Feather name="arrow-up-right" size={20} color={Colors.light.black} />
                  <Text style={styles.actionText}>Send</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => router.push(createAssetConversionHref(asset.code))}
                  style={styles.actionPill}>
                  <Feather name="refresh-cw" size={20} color={Colors.light.black} />
                  <Text style={styles.actionText}>Convert</Text>
                </PressableScale>
              </View>
            </FadeInView>

            <View style={styles.divider} />

            {asset.code === 'ngn' ? (
              <NgnReceivePanel />
            ) : (
              <StablecoinReceivePanel
                assetCode={asset.code}
                onCopied={() => setToastMessage('Wallet address copied')}
              />
            )}
          </View>
        </ScrollView>
        <View pointerEvents="box-none" style={styles.toastOverlay}>
          <FeedbackToast message={toastMessage} tone="success" />
        </View>
      </SafeAreaView>
    </View>
  );
}

function formatPrivateBalanceDisplay(value: string, visible: boolean): string {
  if (!visible) {
    return '••••••';
  }

  if (!value.includes('••••')) {
    return value;
  }

  return value.replace(/^[₦$]\s*/, '');
}

function createAssetConversionHref(assetCode: AssetCode): Href {
  return `/add-money/conversion?asset=${assetDetails[assetCode].displayCode}` as Href;
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

      <PressableScale
        onPress={() => router.push('/add-money/bank-transfer' as Href)}
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

function StablecoinReceivePanel({
  assetCode,
  onCopied,
}: {
  assetCode: Extract<AssetCode, 'usdc' | 'usdt'>;
  onCopied: () => void;
}) {
  const router = useRouter();
  const asset = assetDetails[assetCode];
  const assetDisplayCode = asset.displayCode as 'USDC' | 'USDT';
  const [openedAt] = useState(() => Date.now());
  const routedDepositRef = useRef(false);
  const [fundingInstructions, setFundingInstructions] = useState<KlydeFundingInstructions>();
  const [addressError, setAddressError] = useState('');
  const walletFunding = fundingInstructions?.rail === 'wallet' ? fundingInstructions : undefined;
  const address = walletFunding?.address ?? asset.address ?? '';
  const qrPayload = walletFunding?.qrPayload ?? address;
  const networkName = walletFunding?.networkName ?? asset.networks?.find((network) => network.selected)?.label ?? 'network';
  const tokenSymbol = walletFunding?.tokenSymbol ?? assetDisplayCode;
  const tokenDecimals = walletFunding?.tokenDecimals ?? 6;
  const tokenAddress = walletFunding?.tokenAddress;

  useEffect(() => {
    if (!runtimeConfig.realIntegrationsEnabled) {
      return;
    }

    let mounted = true;

    getKlydeFundingInstructions({
      currency: assetDisplayCode,
      market: 'NG',
      rail: 'wallet',
      chainId: 31337,
    })
      .then((instructions) => {
        if (!mounted) {
          return;
        }

        if (instructions.rail !== 'wallet') {
          setAddressError(
            `Klyde returned ${instructions.currency} ${instructions.rail} instructions instead of ${assetDisplayCode} wallet instructions.`,
          );
          return;
        }

        setFundingInstructions(instructions);
        setAddressError('');
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn(`Could not load ${assetDisplayCode} funding instructions`, error);
        }

        if (mounted) {
          setAddressError(error instanceof Error ? error.message : `Could not load ${assetDisplayCode} funding address.`);
        }
      });

    return () => {
      mounted = false;
    };
  }, [assetDisplayCode]);

  useEffect(() => {
    if (!runtimeConfig.realIntegrationsEnabled || addressError || !walletFunding) {
      return;
    }

    let mounted = true;

    async function pollForStablecoinDeposit() {
      if (routedDepositRef.current) {
        return;
      }

      try {
        const response = await listKlydeTransactions({ page: 1, pageSize: 20 });
        const deposit = response.data.find((transaction) => {
          const createdAt = new Date(transaction.createdAt).getTime();

          return (
            transaction.kind === 'deposit' &&
            transaction.amount.currency === assetDisplayCode &&
            Number.isFinite(createdAt) &&
            createdAt >= openedAt - 5000
          );
        });

        if (!mounted || !deposit) {
          return;
        }

        routedDepositRef.current = true;
        const receiptParam = deposit.receiptId ? `&receiptId=${encodeURIComponent(deposit.receiptId)}` : '';

        router.replace(
          `/operation-success?title=${encodeURIComponent(`${assetDisplayCode} received`)}&amount=${encodeURIComponent(
            formatStablecoinOperationAmount(deposit.amount.display, assetDisplayCode),
          )}&asset=${encodeURIComponent(assetDisplayCode)}&kind=deposit&transactionId=${encodeURIComponent(
            deposit.id,
          )}${receiptParam}` as Href,
        );
      } catch (error) {
        if (__DEV__) {
          console.warn(`Could not poll ${assetDisplayCode} deposits`, error);
        }
      }
    }

    void pollForStablecoinDeposit();
    const interval = setInterval(pollForStablecoinDeposit, 3500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [addressError, assetDisplayCode, openedAt, router, walletFunding]);

  return (
    <FadeInView delay={120} style={styles.receiveSection}>
      <View>
        <Text style={styles.receiveTitle}>{asset.receiveTitle}</Text>
        <Text style={styles.receiveSubtitle}>{asset.receiveSubtitle}</Text>
      </View>

      <View style={styles.networkRow}>
        <View style={[styles.networkPill, styles.networkPillActive]}>
          <Feather name="link" size={17} color="#4B83FF" />
          <Text style={[styles.networkText, styles.networkTextActive]}>{networkName}</Text>
        </View>
      </View>

      <View style={styles.qrCard}>
        <View style={styles.qrBox}>
          <FundingQrCode payload={qrPayload} style={styles.qrSvg} />
          <View style={styles.qrLogo}>
            <Feather name="link-2" size={22} color={Colors.light.black} />
          </View>
        </View>

        <Text selectable style={styles.addressText}>
          {splitAddress(address)}
        </Text>

        <View style={styles.copyRow}>
          <View style={styles.copyButtonSlot}>
            <PressableScale
              onPress={async () => {
                await Clipboard.setStringAsync(address);
                onCopied();
              }}
              style={styles.secondaryButton}>
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

        {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}
        <Text style={styles.depositNote}>
          Only send {tokenSymbol} on {networkName}. Deposits use {tokenDecimals} decimals and are credited after confirmation.
        </Text>
        {tokenAddress ? <Text style={styles.tokenText}>Token contract: {splitAddress(tokenAddress)}</Text> : null}
      </View>
    </FadeInView>
  );
}

function formatStablecoinOperationAmount(display: string, assetCode: 'USDC' | 'USDT'): string {
  const numericAmount = Number(display);

  if (!Number.isFinite(numericAmount)) {
    return `${display} ${assetCode}`;
  }

  return `$${numericAmount.toLocaleString('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
  })}`;
}
