import { Feather } from '@react-native-vector-icons/feather';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { runtimeConfig } from '@/config/runtime';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/features/app-data';
import { resolvePaayeeConfidentialAsset } from '@/integrations/paayee';
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
  const depositAddress = data?.wallet?.address ?? addMoneyDepositAddress;
  const addressError =
    runtimeConfig.realIntegrationsEnabled && !data?.wallet?.address
      ? 'Your Privy wallet is still being prepared. Try again in a moment.'
      : '';
  const confidentialTokenAddress = useMemo(() => {
    try {
      return resolvePaayeeConfidentialAsset(stableAssetCode, runtimeConfig.zamaChainId).tokenAddress;
    } catch {
      return undefined;
    }
  }, [stableAssetCode]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const networkName = network.name;
  const networkShortName = network.shortName;
  const tokenSymbol = stableAssetCode;
  const tokenDecimals = 6;
  const qrPayload = depositAddress;

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
          Public transfers appear after confirmation. You decide when to make the balance private.
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
        <StablecoinInfoBullet text={`${tokenSymbol} deposits use ${tokenDecimals} decimals. After confirmation, open the asset and tap Make private.`} />
        {confidentialTokenAddress ? (
          <StablecoinInfoBullet text={`Direct private receive uses Paayee ${stableAssetCode}: ${splitAddress(confidentialTokenAddress)}`} />
        ) : null}
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
