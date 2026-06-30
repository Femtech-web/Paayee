import { Feather } from '@react-native-vector-icons/feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import {
  sendAssetOptions,
  stablecoinNetworks,
  type SendAssetCode,
  type SendAssetOption,
  type StablecoinNetworkOption,
} from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import {
  defaultStableAsset,
  SharedAmountScreen,
} from '../shared/amount-screen';
import { ScreenShell, TopBar } from '../shared/send-layout';
import {
  BalancePickerSheet,
  NetworkPickerSheet,
} from '../shared/send-sheets';
import { AssetIcon, FieldLabel, FooterButton } from '../shared/send-ui';
import {
  createStablecoinAmountHref,
  findAsset,
  readParam,
} from '../shared/send-utils';

const stablecoinAssetCodes: SendAssetCode[] = ['USDC', 'USDT'];
const stablecoinAssets = sendAssetOptions.filter((asset) =>
  stablecoinAssetCodes.includes(asset.code),
);
const sampleWalletAddress = '0xa4bb6b63c0ece648ec39daca29bc569236bda6f1';

function StablecoinCurrencyField({
  asset,
  onPress,
}: {
  asset: SendAssetOption;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.field, styles.fieldMuted]}>
      <View style={styles.inlineValue}>
        <AssetIcon asset={asset} size={24} />
        <Text style={styles.fieldText}>{asset.code}</Text>
      </View>
      <Feather name="chevron-down" size={20} color="#3F4653" />
    </Pressable>
  );
}

export function NewStablecoinWalletScreen() {
  const router = useRouter();
  const [asset, setAsset] = useState<SendAssetOption>(defaultStableAsset);
  const [network, setNetwork] = useState<StablecoinNetworkOption | null>(null);
  const [address, setAddress] = useState('');
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false);
  const cleanAddress = address.trim();
  const canContinue = Boolean(network && /^0x[a-fA-F0-9]{40}$/.test(cleanAddress));

  return (
    <ScreenShell>
      <TopBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.title}>Send to stablecoin wallet</Text>
        <Text style={styles.subtitle}>Enter the wallet details for a USDC or USDT transfer.</Text>
      </FadeInView>

      <FadeInView delay={120} style={styles.form}>
        <FieldLabel label="Currency">
          <StablecoinCurrencyField asset={asset} onPress={() => setAssetPickerOpen(true)} />
        </FieldLabel>

        <FieldLabel label="Network">
          <Pressable onPress={() => setNetworkPickerOpen(true)} style={styles.field}>
            <Text style={[styles.fieldText, !network && styles.placeholder]}>
              {network?.name ?? 'Select network'}
            </Text>
            <Feather name="chevron-down" size={20} color="#3F4653" />
          </Pressable>
        </FieldLabel>

        <FieldLabel label="Wallet address">
          <View style={styles.field}>
            <TextInput
              value={address}
              onChangeText={(value) => setAddress(value.replace(/\s/g, '').slice(0, 64))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter wallet address"
              placeholderTextColor="#B7BDC8"
              style={styles.textInput}
            />
            <Pressable onPress={() => setAddress(sampleWalletAddress)} style={styles.pasteButton}>
              <Text style={styles.pasteText}>Paste</Text>
            </Pressable>
          </View>
        </FieldLabel>

        <View style={styles.warningCard}>
          <Feather name="alert-octagon" size={18} color="#8A6A22" />
          <Text style={styles.warningText}>
            Check the wallet address and network. Stablecoin transfers cannot be reversed.
          </Text>
        </View>
      </FadeInView>

      <FooterButton
        disabled={!canContinue}
        label="Continue"
        onPress={() => {
          if (network) {
            router.push(
              createStablecoinAmountHref({
                address: cleanAddress,
                asset: asset.code,
                network,
              }),
            );
          }
        }}
      />

      <BalancePickerSheet
        allowedCodes={stablecoinAssetCodes}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={(nextAsset) => {
          setAsset(nextAsset);
          setAssetPickerOpen(false);
        }}
        selectedAsset={asset}
      />
      <NetworkPickerSheet
        networks={stablecoinNetworks}
        onClose={() => setNetworkPickerOpen(false)}
        onSelect={(nextNetwork) => {
          setNetwork(nextNetwork);
          setNetworkPickerOpen(false);
        }}
        open={networkPickerOpen}
        selectedNetwork={network}
      />
    </ScreenShell>
  );
}

export function StablecoinWalletAmountScreen() {
  const params = useLocalSearchParams<{ asset?: SendAssetCode }>();
  const paramAsset = findAsset(readParam(params.asset) as SendAssetCode | undefined);
  const selectedAsset = stablecoinAssets.includes(paramAsset) ? paramAsset : defaultStableAsset;

  return (
    <SharedAmountScreen
      allowedAssetCodes={stablecoinAssetCodes}
      arrivalText="Usually arrives in about 5 minutes"
      defaultSendAsset={selectedAsset}
      fallbackRecipient={{
        id: 'stablecoin-wallet',
        name: stablecoinNetworks[0].name,
        bankName: '',
        accountNumber: sampleWalletAddress,
        initials: 'SC',
      }}
      reviewPath="/send/stablecoin/review"
      title={(asset) => `Send ${asset.code}`}
    />
  );
}
