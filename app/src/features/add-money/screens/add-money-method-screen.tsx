import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useAppData } from '@/features/app-data';
import { BalancePickerSheet } from '@/features/send/flows/shared/send-sheets';
import {
  createSendAssetOptionsFromBalances,
  findSendAssetOption,
  type SendAssetCode,
} from '@/features/send/send-data';

import {
  isStablecoinAsset,
} from '../add-money-data';
import { addMoneyStyles as styles } from '../add-money-screen.styles';
import { AddMoneyShell, TopBar } from '../components/add-money-shell';
import { HeroWithAsset, MethodRow } from '../components/add-money-ui';
import { FadeInView } from '@/components/motion/fade-in-view';

export function AddMoneyMethodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const { data } = useAppData();
  const assets = useMemo(
    () => createSendAssetOptionsFromBalances(data?.balances),
    [data?.balances],
  );
  const initialAsset = findSendAssetOption(Array.isArray(params.asset) ? params.asset[0] : params.asset, assets);
  const [assetCode, setAssetCode] = useState<SendAssetCode>(initialAsset.code);
  const asset = findSendAssetOption(assetCode, assets);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const isStablecoin = isStablecoinAsset(asset);

  return (
    <AddMoneyShell>
      <TopBar />
      <HeroWithAsset asset={asset} onAssetPress={() => setAssetPickerOpen(true)} />

      <FadeInView delay={120} style={styles.methodList}>
        {isStablecoin ? (
          <MethodRow
            icon="link-2"
            title="Add via transfer"
            text={`Fund your ${asset.code} balance with your Paayee wallet address.`}
            onPress={() => router.push(`/add-money/stablecoin-transfer?asset=${asset.code}` as Href)}
          />
        ) : (
          <MethodRow
            icon="home"
            title="Add via bank transfer"
            text="Fund your NGN balance using your Paayee account details."
            onPress={() => router.push('/add-money/bank-transfer?asset=NGN' as Href)}
          />
        )}

        <MethodRow
          icon="refresh-cw"
          title="Add via conversion"
          text={`Convert funds from another balance to your ${asset.code} balance.`}
          onPress={() => router.push(`/add-money/conversion?asset=${asset.code}` as Href)}
        />
      </FadeInView>

      <BalancePickerSheet
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={(nextAsset) => {
          if (__DEV__) {
            console.log('[Paayee add money] selected asset', nextAsset.code);
          }

          setAssetCode(nextAsset.code);
          setAssetPickerOpen(false);
        }}
        selectedAsset={asset}
        assets={assets}
      />
    </AddMoneyShell>
  );
}
