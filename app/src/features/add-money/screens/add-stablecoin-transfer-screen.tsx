import { Feather } from '@react-native-vector-icons/feather';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { runtimeConfig } from '@/config/runtime';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/features/app-data';
import {
  getKlydeConfig,
  getKlydeFundingInstructions,
  resolveKlydeConfidentialAsset,
  simulateKlydeFundingReceived,
  type KlydeFundingInstructions,
} from '@/integrations/klyde';
import {
  createSendAssetOptionsFromBalances,
  findSendAssetOption,
} from '@/features/send/send-data';

import {
  addMoneyDepositAddress,
  addMoneyNetworks,
  isStablecoinAsset,
} from '../add-money-data';
import { addMoneyStyles as styles } from '../add-money-screen.styles';
import { FundingQrCode } from '../components/funding-qr-code';
import { AddMoneyShell, TopBar } from '../components/add-money-shell';
import { splitAddress } from '../components/add-money-ui';

const MAX_SIMULATED_STABLECOIN = 100_000;

export function AddStablecoinTransferScreen() {
  const params = useLocalSearchParams<{ asset?: string }>();
  const { data } = useAppData();
  const assets = useMemo(
    () => createSendAssetOptionsFromBalances(data?.balances),
    [data?.balances],
  );
  const asset = findSendAssetOption(Array.isArray(params.asset) ? params.asset[0] : params.asset, assets);
  const stableAsset = isStablecoinAsset(asset)
    ? asset
    : findSendAssetOption('USDC', assets);
  const stableAssetCode = stableAsset.code as 'USDC' | 'USDT';
  const network = addMoneyNetworks[0];
  const [depositAddress, setDepositAddress] = useState(addMoneyDepositAddress);
  const [fundingInstructions, setFundingInstructions] = useState<KlydeFundingInstructions>();
  const [confidentialTokenAddress, setConfidentialTokenAddress] = useState<string>();
  const [addressError, setAddressError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const showSandboxSimulator = getKlydeConfig().environment !== 'production';
  const walletFunding = fundingInstructions?.rail === 'wallet' ? fundingInstructions : undefined;
  const networkName = walletFunding?.networkName ?? network.name;
  const networkShortName = walletFunding?.networkName ?? network.shortName;
  const tokenSymbol = walletFunding?.tokenSymbol ?? stableAssetCode;
  const tokenDecimals = walletFunding?.tokenDecimals ?? 6;
  const tokenAddress = walletFunding?.tokenAddress;
  const qrPayload = walletFunding?.qrPayload ?? depositAddress;

  useEffect(() => {
    if (!runtimeConfig.realIntegrationsEnabled) {
      return;
    }

    let mounted = true;
    const fundingRequest = {
      currency: stableAssetCode,
      market: 'NG' as const,
      rail: 'wallet' as const,
      chainId: 31337,
    };

    if (__DEV__) {
      console.log('[Paayee funding] requesting stablecoin funding instructions', fundingRequest);
    }

    getKlydeFundingInstructions(fundingRequest, {
      idempotencyKey: `paayee-stablecoin-funding-${stableAssetCode}-${Date.now()}`,
    })
      .then((instructions) => {
        if (__DEV__) {
          console.log('[Paayee funding] received funding instructions', {
            currency: instructions.currency,
            rail: instructions.rail,
            provider: instructions.provider,
            chainId: instructions.rail === 'wallet' ? instructions.chainId : undefined,
            networkName: instructions.rail === 'wallet' ? instructions.networkName : undefined,
            tokenSymbol: instructions.rail === 'wallet' ? instructions.tokenSymbol : undefined,
          });
        }

        if (mounted) {
          if (instructions.rail !== 'wallet') {
            setAddressError(
              `Klyde returned ${instructions.currency} ${instructions.rail} instructions instead of ${stableAssetCode} wallet instructions.`,
            );
            return;
          }

          setFundingInstructions(instructions);
          setDepositAddress(instructions.address);
          setAddressError('');
        }
      })
      .catch((fundingError) => {
        if (__DEV__) {
          console.warn('Could not load Klyde stablecoin funding instructions', fundingError);
        }

        if (mounted) {
          setAddressError(formatStablecoinFundingInstructionsError(fundingError));
        }
      });

    resolveKlydeConfidentialAsset({
      chainId: fundingRequest.chainId,
      underlyingSymbol: stableAssetCode,
    })
      .then((asset) => {
        if (mounted) {
          setConfidentialTokenAddress(asset.tokenAddress);
        }
      })
      .catch(() => {
        if (mounted) {
          setConfidentialTokenAddress(undefined);
        }
      });

    return () => {
      mounted = false;
    };
  }, [stableAssetCode]);

  useEffect(() => {
    if (!errorMessage && !successMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, 3500);

    return () => clearTimeout(timeout);
  }, [errorMessage, successMessage]);

  const overlay = (
    <>
      <FeedbackToast message={errorMessage} tone="error" />
      <FeedbackToast message={successMessage} tone="success" />
    </>
  );

  return (
    <AddMoneyShell overlay={overlay}>
      <TopBar />
      <FadeInView delay={60} style={styles.heroCopy}>
        <Text style={styles.title}>Add {stableAssetCode} via transfer</Text>
        <Text style={styles.subtitle}>Make a transfer to the wallet address below.</Text>
      </FadeInView>

      <FadeInView delay={110} style={styles.networkRow}>
        <View style={styles.networkPill}>
          <Feather name="link-2" size={17} color="#3D72EA" />
          <Text style={styles.networkText}>{networkShortName}</Text>
        </View>
      </FadeInView>

      <FadeInView delay={150} style={[styles.card, styles.qrCard]}>
        <View style={styles.qrBox}>
          <FundingQrCode payload={qrPayload} style={styles.qrSvg} />
          <View style={styles.qrLogo}>
            <Feather name="link-2" size={22} color={Colors.light.black} />
          </View>
        </View>

        <Text selectable style={styles.addressText}>
          {splitAddress(depositAddress)}
        </Text>

        <PressableScale
          onPress={async () => {
            await Clipboard.setStringAsync(depositAddress);
            setErrorMessage('');
            setSuccessMessage('Wallet address copied');
          }}
          style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Copy</Text>
          <Feather name="copy" size={16} color="#3D72EA" />
        </PressableScale>
        {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}

        <Text style={styles.noteText}>
          Only send {tokenSymbol} on the {networkName} network to this address.
          Public transfers are shielded into your private Paayee balance after confirmation.
        </Text>
      </FadeInView>

      <View style={styles.divider} />

      {/*
      {showSandboxSimulator ? (
        <StablecoinFundingSimulator
          assetCode={stableAssetCode}
          chainId={network.chainId}
          depositAddress={depositAddress}
          onError={(message) => {
            setSuccessMessage('');
            setErrorMessage(message);
          }}
          onTransactionCreated={(depositId, receiptId, amount) => {
            const receiptParam = receiptId ? `&receiptId=${encodeURIComponent(receiptId)}` : '';

            router.replace(
              `/operation-success?title=${encodeURIComponent(`${stableAssetCode} received`)}&amount=${encodeURIComponent(
                `$${amount.toLocaleString('en-US')}`,
              )}&asset=${encodeURIComponent(stableAssetCode)}&kind=deposit&transactionId=${encodeURIComponent(
                depositId,
              )}${receiptParam}` as Href,
            );
          }}
        />
      ) : null}
      */}

      <FadeInView delay={190} style={styles.stablecoinInfoCard}>
        <Text style={styles.stablecoinInfoTitle}>Transfer note</Text>
        <StablecoinInfoBullet
          text={`Send only ${tokenSymbol} on ${networkShortName}. Other tokens or networks may not arrive automatically.`}
        />
        <StablecoinInfoBullet text={`${tokenSymbol} deposits use ${tokenDecimals} decimals and are credited after confidential shielding.`} />
        {confidentialTokenAddress ? (
          <StablecoinInfoBullet text={`Direct private receive uses Paayee ${stableAssetCode}: ${splitAddress(confidentialTokenAddress)}`} />
        ) : null}
        {tokenAddress ? <StablecoinInfoBullet text={`Token contract: ${splitAddress(tokenAddress)}`} /> : null}
      </FadeInView>
    </AddMoneyShell>
  );
}

function StablecoinInfoBullet({ text }: { text: string }) {
  return (
    <View style={styles.stablecoinInfoBulletRow}>
      <View style={styles.stablecoinInfoBulletDot} />
      <Text style={styles.stablecoinInfoText}>{text}</Text>
    </View>
  );
}

function formatStablecoinFundingInstructionsError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (isKlydeSessionError(error) || normalized.includes('authenticated user context') || normalized.includes('unauthorized')) {
    return 'We could not restore your money session. Please try again.';
  }

  if (normalized.includes('wallet was not found') || normalized.includes('funding chain')) {
    return message;
  }

  if (normalized.includes('unsupported stablecoin funding currency')) {
    return message;
  }

  if (normalized.includes('network') || normalized.includes('fetch failed') || normalized.includes('network request failed')) {
    return 'We could not connect to Klyde funding right now. Please check that the API is running.';
  }

  return message || 'Could not load your stablecoin funding address.';
}

function isKlydeSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  return (
    code === 'KYLDE_SESSION_MISSING' ||
    code === 'KYLDE_REFRESH_TOKEN_EXPIRED' ||
    code === 'KYLDE_REFRESH_TOKEN_REVOKED' ||
    code === 'KYLDE_UNAUTHORIZED'
  );
}

function StablecoinFundingSimulator({
  assetCode,
  chainId,
  depositAddress,
  onError,
  onTransactionCreated,
}: {
  assetCode: 'USDC' | 'USDT';
  chainId: number;
  depositAddress: string;
  onError: (message: string) => void;
  onTransactionCreated: (depositId: string, receiptId: string | undefined, amount: number) => void;
}) {
  const [amount, setAmount] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const numericAmount = Number(amount || 0);
  const disabled = submitting || !Number.isFinite(numericAmount) || numericAmount <= 0;

  async function handleSimulateFunding() {
    if (numericAmount <= 0) {
      onError('Enter an amount to simulate.');
      return;
    }

    if (numericAmount > MAX_SIMULATED_STABLECOIN) {
      onError('Use 100,000 or less for a simulated transfer.');
      return;
    }

    setSubmitting(true);
    onError('');

    try {
      const result = await simulateKlydeFundingReceived({
        amount: {
          display: String(numericAmount),
          currency: assetCode,
          minorUnits: String(Math.round(numericAmount * 1_000_000)),
          scale: 6,
        },
        provider: 'wallet',
        source: {
          type: 'wallet',
          address: depositAddress,
          chainId,
        },
      });

      onTransactionCreated(result.deposit.id, result.deposit.receiptId, numericAmount);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not simulate this transfer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FadeInView delay={180} style={styles.simulatorCard}>
      <View style={styles.simulatorCopy}>
        <Text style={styles.simulatorTitle}>Simulate transfer received</Text>
        <Text style={styles.simulatorText}>Sandbox only. This confirms the {assetCode} funding flow without an onchain transfer.</Text>
      </View>
      <View style={styles.simulatorInputRow}>
        <Text style={styles.simulatorCurrency}>$</Text>
        <TextInput
          accessibilityLabel={`Simulated ${assetCode} transfer amount`}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setAmount(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="100"
          placeholderTextColor="#A2ABBA"
          style={styles.simulatorInput}
          value={amount}
        />
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Simulate ${assetCode} transfer received`}
        disabled={disabled}
        onPress={handleSimulateFunding}
        style={[styles.simulatorButton, disabled && styles.simulatorButtonDisabled]}>
        <Text style={styles.simulatorButtonText}>{submitting ? 'Simulating...' : 'Simulate received'}</Text>
        <Feather name="arrow-right" size={16} color={Colors.light.white} />
      </PressableScale>
    </FadeInView>
  );
}
