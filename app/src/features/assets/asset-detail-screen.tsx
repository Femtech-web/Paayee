import { Feather } from '@react-native-vector-icons/feather';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import * as Clipboard from 'expo-clipboard';
import { type Href, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatUnits, parseUnits } from 'viem';

import { FeedbackToast } from '@/components/feedback-toast';
import UsdcLogo from '../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../assets/icons/usdt.svg';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { runtimeConfig } from '@/config/runtime';
import {
  clearPaayeeConfidentialBalanceCache,
  revealPaayeeConfidentialBalances,
} from '@/features/confidential/confidential-money';
import { readPaayeeWalletError } from '@/features/confidential/wallet-errors';
import {
  executePaayeeConfidentialShield,
  executePaayeeConfidentialUnshield,
  getPaayeePublicTokenBalance,
} from '@/features/confidential/zama-mobile-runtime';
import { getPaayeeNetworkFeeQuote, recordPaayeePrivacyOperation, type PaayeeFeeQuote } from '@/integrations/paayee';
import { FundingQrCode } from '@/features/add-money/components/funding-qr-code';
import { useAppData } from '@/features/app-data';
import { claimDepositReceiptNotification } from '@/features/app-data/deposit-receipt-notifications';
import { splitAddress } from '../add-money/components/add-money-ui';
import { assetDetails, type AssetCode } from './asset-data';
import { styles } from './asset-detail-screen.styles';

const nigeriaFlag = require('../../../assets/images/nigeria.png');

type AssetDetailScreenProps = {
  assetCode: AssetCode;
};

export function AssetDetailScreen({ assetCode }: AssetDetailScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ action?: string }>();
  const requestedAction = Array.isArray(params.action) ? params.action[0] : params.action;
  const initialPrivacyAction: PrivacyAction | undefined =
    assetCode !== 'ngn' && (requestedAction === 'shield' || requestedAction === 'unshield')
      ? requestedAction
      : undefined;
  const { wallets } = useEmbeddedEthereumWallet();
  const walletAddress = wallets[0]?.address;
  const asset = assetDetails[assetCode];
  const { data, loading, refresh } = useAppData();
  const liveBalance = data?.balances.find(
    (balance) => balance.code.toLowerCase() === assetCode,
  );
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [balanceRevealLoading, setBalanceRevealLoading] = useState(false);
  const [balanceMode, setBalanceMode] = useState<'public' | 'private'>(
    initialPrivacyAction === 'unshield' ? 'private' : 'public',
  );
  const [privacyAction, setPrivacyAction] = useState<PrivacyAction | undefined>(initialPrivacyAction);
  const [publicBalance, setPublicBalance] = useState<bigint>(0n);
  const [publicBalanceLoading, setPublicBalanceLoading] = useState(false);
  const latestSeenActivityId = useRef<string | undefined>(undefined);
  const latestActivity = data?.transactions[0];
  const latestActivitySignature = latestActivity ? `${latestActivity.id}:${latestActivity.detail}` : undefined;
  const displayBalance = liveBalance?.displayAmount ?? asset.balance;
  const isStablecoin = asset.code === 'usdc' || asset.code === 'usdt';
  const privateBalanceDisplay = formatPrivateBalanceDisplay(displayBalance, balanceVisible);
  const privateHeroBalance = isStablecoin && balanceVisible && !privateBalanceDisplay.endsWith(asset.displayCode)
    ? `${privateBalanceDisplay} ${asset.displayCode}`
    : privateBalanceDisplay;
  const resolvedPublicBalance = liveBalance?.publicNumericAmount === undefined
    ? publicBalance
    : BigInt(Math.round(liveBalance.publicNumericAmount * 1_000_000));
  const resolvedPublicBalanceDisplay = formatStablecoinBalance(resolvedPublicBalance, asset.displayCode, balanceVisible);
  const heroBalance = isStablecoin && balanceMode === 'public' ? resolvedPublicBalanceDisplay : privateHeroBalance;
  const displayName = liveBalance?.name ?? asset.balanceLabel;
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'error' | 'success'>('success');

  function showToast(message: string, tone: 'error' | 'success' = 'success') {
    setToastTone(tone);
    setToastMessage(message);
  }

  async function reloadPublicBalance() {
    if (!isStablecoin || !walletAddress || !asset.publicTokenAddress) return;
    setPublicBalanceLoading(true);
    try {
      setPublicBalance(await getPaayeePublicTokenBalance({
        chainId: runtimeConfig.zamaChainId,
        owner: walletAddress,
        tokenAddress: asset.publicTokenAddress,
      }));
    } finally {
      setPublicBalanceLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isStablecoin || !walletAddress || !asset.publicTokenAddress) return;
      setPublicBalanceLoading(true);
      void getPaayeePublicTokenBalance({
        chainId: runtimeConfig.zamaChainId,
        owner: walletAddress,
        tokenAddress: asset.publicTokenAddress,
      }).then(setPublicBalance).finally(() => setPublicBalanceLoading(false));
    }, 0);
    return () => clearTimeout(timeout);
  }, [asset.publicTokenAddress, isStablecoin, walletAddress]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => setToastMessage(''), 3500);

    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!latestActivitySignature || pathname !== `/asset/${asset.code}`) {
      return;
    }

    if (latestSeenActivityId.current === latestActivitySignature) return;
    latestSeenActivityId.current = latestActivitySignature;
    setBalanceVisible(false);

    if (latestActivity?.kind === 'deposit' && latestActivity.detail.startsWith('Confirmed')) {
      void claimDepositReceiptNotification(data?.profile.smartAccountAddress, latestActivity).then((shouldOpen) => {
        if (shouldOpen) {
          const receiptParam = latestActivity.receiptId
            ? `&receiptId=${encodeURIComponent(latestActivity.receiptId)}`
            : '';
        router.push(
          `/operation-success?title=${encodeURIComponent(latestActivity.title)}&amount=${encodeURIComponent(
            latestActivity.amount.replace(/^\+/, ''),
          )}&asset=${encodeURIComponent(asset.code)}&kind=deposit&transactionId=${encodeURIComponent(latestActivity.id)}${receiptParam}` as Href,
        );
        }
      });
    }
  }, [asset.code, data?.profile.smartAccountAddress, latestActivity, latestActivitySignature, pathname, router]);

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
              {isStablecoin ? (
                <View accessibilityRole="tablist" style={styles.balanceModeToggle}>
                  {(['public', 'private'] as const).map((mode) => {
                    const selected = balanceMode === mode;
                    return (
                      <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        key={mode}
                        onPress={() => setBalanceMode(mode)}
                        style={[styles.balanceModeOption, selected && styles.balanceModeOptionActive]}>
                        <Feather
                          name={mode === 'public' ? 'globe' : 'shield'}
                          size={14}
                          color={selected ? '#17120E' : '#8E928F'}
                        />
                        <Text style={[styles.balanceModeText, selected && styles.balanceModeTextActive]}>
                          {mode === 'public' ? 'Public' : 'Private'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <View style={styles.balanceRow}>
                {loading || (isStablecoin && balanceMode === 'public' && publicBalanceLoading) || (balanceRevealLoading && balanceVisible) ? (
                  <SkeletonBlock style={styles.balanceSkeleton} />
                ) : (
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.balance}>{heroBalance}</Text>
                )}
                <Pressable
                  onPress={async () => {
                    if (balanceVisible) {
                      setBalanceVisible(false);
                      return;
                    }

                    setBalanceVisible(true);
                    if (!isStablecoin || balanceMode === 'private') {
                      setBalanceRevealLoading(true);
                      try {
                        await revealPaayeeConfidentialBalances({
                          assetCodes: [asset.displayCode as 'USDC' | 'USDT'],
                          chainId: runtimeConfig.zamaChainId,
                          owner: walletAddress,
                        });
                        await refresh({ silent: true });
                      } catch (error) {
                        setBalanceVisible(false);
                        showToast(readPaayeeWalletError(
                          error,
                          'Could not reveal this private balance. Please try again.',
                        ), 'error');
                      } finally {
                        setBalanceRevealLoading(false);
                      }
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
                  <View style={styles.actionIconCircle}>
                    <Feather name="arrow-up-right" size={20} color={Colors.light.black} />
                  </View>
                  <Text style={styles.actionText}>Send</Text>
                </PressableScale>
                <PressableScale
                  disabled
                  style={[styles.actionPill, styles.actionPillDisabled]}>
                  <View style={styles.actionIconCircle}>
                    <Feather name="refresh-cw" size={19} color="#A9AFBA" />
                  </View>
                  <View style={styles.actionLabelGroup}>
                    <Text style={[styles.actionText, styles.actionTextDisabled]}>Convert</Text>
                    <Text style={styles.actionSoonText}>Soon</Text>
                  </View>
                </PressableScale>
                {isStablecoin ? (
                  <PressableScale
                    onPress={() => setPrivacyAction(balanceMode === 'public' ? 'shield' : 'unshield')}
                    style={[styles.actionPill, styles.privacyActionPill]}>
                    <View style={[styles.actionIconCircle, styles.privacyActionIconCircle]}>
                      <Feather name={balanceMode === 'public' ? 'shield' : 'unlock'} size={19} color={Colors.light.primary} />
                    </View>
                    <Text style={styles.actionText}>{balanceMode === 'public' ? 'Shield' : 'Unshield'}</Text>
                  </PressableScale>
                ) : null}
              </View>
            </FadeInView>

            {isStablecoin && privacyAction ? (
              <PrivacyActionSheet
                action={privacyAction}
                assetCode={asset.code as 'usdc' | 'usdt'}
                privateBalance={liveBalance?.numericAmount}
                privateBalanceKnown={liveBalance?.confidentialityStatus === 'available'}
                publicBalance={resolvedPublicBalance}
                displayCurrency={data?.displayCurrency ?? 'NGN'}
                onClose={() => setPrivacyAction(undefined)}
                onChanged={async () => {
                  setBalanceVisible(false);
                  clearPaayeeConfidentialBalanceCache({
                    assetCode: asset.displayCode as 'USDC' | 'USDT',
                    chainId: runtimeConfig.zamaChainId,
                    owner: walletAddress,
                  });
                  await Promise.all([refresh({ silent: true }), reloadPublicBalance()]);
                }}
                onMessage={(message) => showToast(message)}
              />
            ) : null}

            <View style={styles.divider} />

            {asset.code === 'ngn' ? (
              <NgnReceivePanel />
            ) : (
              <StablecoinReceivePanel
                assetCode={asset.code}
                onCopied={() => showToast('Wallet address copied')}
              />
            )}
          </View>
        </ScrollView>
        <View pointerEvents="box-none" style={styles.toastOverlay}>
          <FeedbackToast message={toastMessage} tone={toastTone} />
        </View>
      </SafeAreaView>
    </View>
  );
}

type PrivacyAction = 'shield' | 'unshield';

function PrivacyActionSheet({
  action,
  assetCode,
  privateBalance,
  privateBalanceKnown,
  publicBalance,
  displayCurrency,
  onClose,
  onChanged,
  onMessage,
}: {
  action: PrivacyAction;
  assetCode: 'usdc' | 'usdt';
  privateBalance?: number;
  privateBalanceKnown: boolean;
  publicBalance: bigint;
  displayCurrency: 'NGN' | 'USD';
  onClose: () => void;
  onChanged: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const asset = assetDetails[assetCode];
  const symbol = asset.displayCode as 'USDC' | 'USDT';
  const confidentialAddress = symbol === 'USDC' ? runtimeConfig.paayeeCusdcAddress : runtimeConfig.paayeeCusdtAddress;
  const [selectedAction, setSelectedAction] = useState<PrivacyAction>(action);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [error, setError] = useState('');
  const [feeQuote, setFeeQuote] = useState<PaayeeFeeQuote>();
  const [feeLoading, setFeeLoading] = useState(false);

  const sourceBalance = selectedAction === 'shield'
    ? formatUnits(publicBalance, 6)
    : privateBalanceKnown ? formatFriendlyAmount(privateBalance ?? 0) : undefined;
  const feeMinorUnits = BigInt(feeQuote?.feeAssetMinorUnits ?? '0');
  const parsedAmount = readPositiveAmountMinorUnits(amount);
  const receiveMinorUnits = parsedAmount === undefined
    ? 0n
    : selectedAction === 'unshield' ? parsedAmount - feeMinorUnits : parsedAmount;

  useEffect(() => {
    const amountMinorUnits = readPositiveAmountMinorUnits(amount);
    if (amountMinorUnits === undefined) {
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      void getPaayeeNetworkFeeQuote({
        amountMinorUnits: amountMinorUnits.toString(),
        assetCode: symbol,
        chainId: runtimeConfig.zamaChainId,
        displayCurrency,
        kind: selectedAction,
      }).then((quote) => {
        if (!cancelled) setFeeQuote(quote);
      }).catch((cause) => {
        if (!cancelled) {
          setFeeQuote(undefined);
          console.warn('[paayee.fees] quote_failed', cause);
          setError(readPaayeeWalletError(cause, 'Could not calculate the current network fee.'));
        }
      }).finally(() => {
        if (!cancelled) setFeeLoading(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [amount, displayCurrency, selectedAction, symbol]);

  function selectAction(nextAction: PrivacyAction) {
    if (submitting) return;
    setSelectedAction(nextAction);
    setAmount('');
    setFeeQuote(undefined);
    setFeeLoading(false);
    setError('');
  }

  function useMaximum() {
    if (sourceBalance === undefined) {
      setError('Reveal your private balance first to use Max. You can still enter an amount.');
      return;
    }
    setAmount(sourceBalance);
    setFeeQuote(undefined);
    setFeeLoading(true);
    setError('');
  }

  async function submit() {
    if (!asset.publicTokenAddress || !confidentialAddress) {
      setError('This Paayee asset is not configured for privacy yet.');
      return;
    }
    if (!feeQuote || feeLoading) {
      setError('Wait a moment while Paayee calculates the current network fee.');
      return;
    }
    let amountMinorUnits: string;
    try {
      const parsed = parseUnits(amount.trim(), 6);
      if (parsed <= 0n) throw new Error();
      if (selectedAction === 'shield' && parsed + feeMinorUnits > publicBalance) {
        setError(`You need ${formatUnits(parsed + feeMinorUnits, 6)} ${symbol} including the network fee.`);
        return;
      }
      if (selectedAction === 'unshield' && privateBalanceKnown && Number(amount) > (privateBalance ?? 0)) {
        setError(`You only have ${formatFriendlyAmount(privateBalance ?? 0)} private ${symbol}.`);
        return;
      }
      if (selectedAction === 'unshield' && parsed <= feeMinorUnits) {
        setError(`Enter more than the ${feeQuote.feeAssetDisplay} ${symbol} network fee.`);
        return;
      }
      amountMinorUnits = parsed.toString();
    } catch {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);
    setSubmitProgress(selectedAction === 'shield' ? 'Shielding…' : 'Preparing unshield · 1/2');
    setError('');
    try {
      const result = selectedAction === 'shield'
        ? await executePaayeeConfidentialShield({
            amountMinorUnits,
            publicTokenAddress: asset.publicTokenAddress,
            confidentialTokenAddress: confidentialAddress,
            onProgress: setSubmitProgress,
          })
        : await executePaayeeConfidentialUnshield({
            amountMinorUnits,
            chainId: runtimeConfig.zamaChainId,
            onProgress: setSubmitProgress,
            tokenAddress: confidentialAddress,
          });
      if (!result.transactionHash) throw new Error('The wallet did not return a transaction hash.');
      await recordPaayeePrivacyOperation({
        amountMinorUnits: result.amountMinorUnits ?? amountMinorUnits,
        chainId: runtimeConfig.zamaChainId,
        confidentialTokenAddress: confidentialAddress,
        kind: selectedAction,
        publicTokenAddress: asset.publicTokenAddress,
        tokenSymbol: symbol,
        transactionHash: result.transactionHash,
      });
      setAmount('');
      await onChanged();
      onMessage(selectedAction === 'shield' ? `${symbol} is now private` : `${symbol} moved to public balance`);
      onClose();
    } catch (cause) {
      if (__DEV__) {
        console.warn('[paayee.privacy.action]', {
          action: selectedAction,
          error: cause instanceof Error ? cause.message : String(cause),
          symbol,
        });
      }
      setError(readPaayeeWalletError(cause, 'The privacy transaction could not be completed. Please try again.'));
    } finally {
      setSubmitting(false);
      setSubmitProgress('');
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => !submitting && onClose()}>
        <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetDismissArea} onPress={() => !submitting && onClose()} />
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedAction === 'shield' ? 'Make money private' : 'Move money to public'}</Text>
                <Text style={styles.sheetSubtitle}>Sepolia · {symbol}</Text>
              </View>
              <Pressable accessibilityLabel="Close" onPress={() => !submitting && onClose()} style={styles.sheetClose}>
                <Feather name="x" size={20} color="#172033" />
              </Pressable>
            </View>

            <View style={styles.sheetModeToggle}>
              <Pressable onPress={() => selectAction('shield')} style={[styles.sheetModeOption, selectedAction === 'shield' && styles.sheetModeOptionActive]}>
                <Feather name="shield" size={17} color={selectedAction === 'shield' ? '#17120E' : '#969AA4'} />
                <Text style={[styles.sheetModeText, selectedAction === 'shield' && styles.sheetModeTextActive]}>Shield</Text>
              </Pressable>
              <Pressable onPress={() => selectAction('unshield')} style={[styles.sheetModeOption, selectedAction === 'unshield' && styles.sheetModeOptionActive]}>
                <Feather name="unlock" size={17} color={selectedAction === 'unshield' ? '#17120E' : '#969AA4'} />
                <Text style={[styles.sheetModeText, selectedAction === 'unshield' && styles.sheetModeTextActive]}>Unshield</Text>
              </Pressable>
            </View>

            <View style={styles.transferPanel}>
              <View style={styles.transferPanelHeader}>
                <Text style={styles.transferEyebrow}>YOU SEND</Text>
                <View style={styles.tokenBadge}>
                  <AssetIcon code={assetCode} compact />
                  <Text style={styles.tokenBadgeText}>{selectedAction === 'shield' ? symbol : `c${symbol}`}</Text>
                </View>
              </View>
              <TextInput
                autoFocus
                editable={!submitting}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setAmount(value);
                  setFeeQuote(undefined);
                  setFeeLoading(Boolean(value.trim()));
                  setError('');
                }}
                placeholder="0"
                placeholderTextColor="#A6A39D"
                style={styles.transferAmountInput}
                value={amount}
              />
              <View style={styles.transferBalanceRow}>
                <Text style={styles.transferBalanceText}>
                  {sourceBalance === undefined ? 'Private balance hidden' : `Available ${sourceBalance} ${symbol}`}
                </Text>
                <Pressable accessibilityRole="button" onPress={useMaximum} hitSlop={8}>
                  <Text style={styles.maxText}>Max</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.transferDirectionIcon}>
              <Feather name="arrow-down" size={18} color="#17120E" />
            </View>

            <View style={styles.transferPanel}>
              <View style={styles.transferPanelHeader}>
                <Text style={styles.transferEyebrow}>YOU RECEIVE</Text>
                <Text style={styles.privacyDestination}>{selectedAction === 'shield' ? 'Private' : 'Public'}</Text>
              </View>
              <View style={styles.receiveAmountRow}>
                <Text style={[styles.receiveAmount, !amount && styles.receiveAmountPlaceholder]}>
                  {receiveMinorUnits > 0n ? formatUnits(receiveMinorUnits, 6) : '0'}
                </Text>
                <View style={styles.tokenBadge}>
                  <AssetIcon code={assetCode} compact />
                  <Text style={styles.tokenBadgeText}>{selectedAction === 'shield' ? `c${symbol}` : symbol}</Text>
                </View>
              </View>
              <Text style={styles.transferBalanceText}>
                {selectedAction === 'shield' ? 'Encrypted onchain after confirmation' : 'Ready to send after confirmation'}
              </Text>
            </View>

            <View style={styles.feeSummary}>
              <View style={styles.feeSummaryRow}>
                <Text style={styles.feeSummaryLabel}>Network fee</Text>
                <Text style={styles.feeSummaryValue}>
                  {feeLoading ? 'Calculating…' : feeQuote
                    ? feeMinorUnits === 0n ? 'Free' : `${feeQuote.feeAssetDisplay} ${symbol} · ${formatFeeDisplay(feeQuote)}`
                    : '—'}
                </Text>
              </View>
              <View style={styles.feeSummaryRow}>
                <Text style={styles.feeSummaryTotalLabel}>Total from you</Text>
                <Text style={styles.feeSummaryTotalValue}>
                  {parsedAmount === undefined ? `0 ${symbol}` : `${formatUnits(
                    selectedAction === 'shield' ? parsedAmount + feeMinorUnits : parsedAmount,
                    6,
                  )} ${symbol}`}
                </Text>
              </View>
            </View>

            {error ? <Text style={styles.sheetError}>{error}</Text> : null}
            <PressableScale disabled={submitting || feeLoading || !feeQuote || !amount.trim()} onPress={() => void submit()} style={[styles.sheetSubmit, (submitting || feeLoading || !feeQuote || !amount.trim()) && styles.sheetSubmitDisabled]}>
              {submitting ? (
                <View style={styles.sheetSubmitProgress}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.sheetSubmitText}>{submitProgress}</Text>
                </View>
              ) : <Text style={styles.sheetSubmitText}>{selectedAction === 'shield' ? `Shield ${symbol}` : `Unshield ${symbol}`}</Text>}
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
  );
}

function formatStablecoinBalance(value: bigint, symbol: string, visible: boolean): string {
  return visible ? `$${formatFriendlyAmount(Number(formatUnits(value, 6)))} ${symbol}` : '••••••';
}

function readPositiveAmountMinorUnits(value: string): bigint | undefined {
  try {
    const parsed = parseUnits(value.trim(), 6);
    return parsed > 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function formatFeeDisplay(quote: PaayeeFeeQuote): string {
  const amount = Number(quote.displayAmount);
  if (quote.displayCurrency === 'NGN') {
    return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;
}

function formatFriendlyAmount(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value);
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

function AssetIcon({ code, compact = false, large = false }: { code: AssetCode; compact?: boolean; large?: boolean }) {
  const size = compact ? 24 : large ? 52 : 42;

  if (code === 'ngn') {
    return <Image source={nigeriaFlag} style={[styles.assetImage, { width: size, height: size }]} />;
  }

  if (code === 'usdc') {
    return <UsdcLogo width={size} height={size} />;
  }

  return <UsdtLogo width={size} height={size} />;
}

function NgnReceivePanel() {
  return (
    <FadeInView delay={120} style={styles.receiveSection}>
      <View>
        <Text style={styles.receiveTitle}>Receive NGN</Text>
        <Text style={styles.receiveSubtitle}>Add money to your Paayee NGN balance</Text>
      </View>

      <PressableScale
        disabled
        style={[styles.ngnSetupCard, styles.ngnSetupCardDisabled]}>
        <View style={styles.ngnSetupCopy}>
          <View style={styles.ngnSetupTitleRow}>
            <Text style={styles.ngnSetupTitle}>NGN bank funding</Text>
            <View style={styles.ngnSoonBadge}>
              <Text style={styles.ngnSoonBadgeText}>Soon</Text>
            </View>
          </View>
          <Text style={styles.ngnSetupText}>
            Bank account funding will open when Paayee’s regulated fiat provider is connected.
          </Text>
          <View style={[styles.primaryMiniButton, styles.primaryMiniButtonDisabled]}>
            <Text style={styles.primaryMiniButtonDisabledText}>Provider setup in progress</Text>
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
  const asset = assetDetails[assetCode];
  const assetDisplayCode = asset.displayCode as 'USDC' | 'USDT';
  const { wallets } = useEmbeddedEthereumWallet();
  const address = wallets[0]?.address ?? '';
  const networkName = asset.networks?.find((network) => network.selected)?.label ?? 'Sepolia';
  const tokenDecimals = 6;
  const tokenAddress = asset.publicTokenAddress;
  const confidentialTokenAddress = assetDisplayCode === 'USDC'
    ? runtimeConfig.paayeeCusdcAddress
    : runtimeConfig.paayeeCusdtAddress;
  const walletPending = !address;

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
          {address ? (
            <>
              <FundingQrCode payload={address} style={styles.qrSvg} />
              <View style={styles.qrLogo}>
                <Feather name="link-2" size={22} color={Colors.light.black} />
              </View>
            </>
          ) : (
            <Feather name="shield" size={42} color="#9CA5B7" />
          )}
        </View>

        <Text selectable style={styles.addressText}>
          {address ? splitAddress(address) : 'Setting up your Privy wallet…'}
        </Text>

        <View style={styles.copyRow}>
          <View style={styles.copyButtonSlot}>
            <PressableScale
              accessibilityState={{ disabled: walletPending }}
              onPress={address ? async () => {
                await Clipboard.setStringAsync(address);
                onCopied();
              } : undefined}
              style={[styles.secondaryButton, walletPending && { opacity: 0.45 }]}>
              <Text numberOfLines={1} style={styles.secondaryButtonText}>
                Copy
              </Text>
              <Feather name="copy" size={16} color="#4B83FF" />
            </PressableScale>
          </View>
          <View style={styles.copyButtonSlot}>
            <PressableScale
              accessibilityState={{ disabled: walletPending }}
              onPress={address ? () => Share.share({
                message: `Receive ${assetDisplayCode} on Sepolia at ${address}`,
                title: `Receive ${assetDisplayCode}`,
              }) : undefined}
              style={[styles.secondaryButton, walletPending && { opacity: 0.45 }]}>
              <Text numberOfLines={1} style={styles.secondaryButtonText}>
                Share via
              </Text>
              <Feather name="share" size={16} color="#4B83FF" />
            </PressableScale>
          </View>
        </View>

        {walletPending ? (
          <Text style={styles.errorText}>Your secure Privy wallet is still being created. Try again in a moment.</Text>
        ) : null}
        <Text style={styles.depositNote}>
          {asset.depositNote} Deposits use {tokenDecimals} decimals.
        </Text>
        {tokenAddress ? <Text style={styles.tokenText}>Token contract: {splitAddress(tokenAddress)}</Text> : null}
        {confidentialTokenAddress ? (
          <Text style={styles.tokenText}>Private asset: {splitAddress(confidentialTokenAddress)}</Text>
        ) : null}
      </View>
    </FadeInView>
  );
}
