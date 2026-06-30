import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import {
  addMoneyDepositAddress,
  addMoneyNetworks,
  findAddMoneyAsset,
  getSourceAsset,
  isStablecoinAsset,
} from './add-money-data';
import { addMoneyStyles as styles } from './add-money-screen.styles';
import {
  sendAssetOptions,
  type SendAssetOption,
} from '@/features/send/send-data';
import { BalancePickerSheet } from '@/features/send/flows/shared/send-sheets';
import {
  AssetIcon,
  AssetPill,
  FooterButton,
  SummaryRow,
} from '@/features/send/flows/shared/send-ui';
import {
  convertAmount,
  formatMoney,
  getTransferFee,
  readRateLabel,
} from '@/features/send/flows/shared/send-utils';
import { sendStyles as sendAmountStyles } from '@/features/send/send-screen.styles';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const qrCells = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return row === 0 || col === 0 || row === 8 || col === 8 || (row * 2 + col) % 4 === 0 || row === col;
});

function splitAddress(address: string) {
  const middle = Math.ceil(address.length / 2);

  return `${address.slice(0, middle)}\n${address.slice(middle)}`;
}

function AddMoneyShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.shell}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TopBar() {
  const router = useRouter();

  return (
    <FadeInView style={styles.topBar}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.backButton}>
        <Feather name="chevron-left" size={26} color={Colors.light.black} />
      </PressableScale>
      <View style={styles.topSpacer} />
    </FadeInView>
  );
}

function MethodRow({
  icon,
  onPress,
  text,
  title,
}: {
  icon: FeatherName;
  onPress: () => void;
  text: string;
  title: string;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.methodRow}>
      <View style={styles.methodIcon}>
        <Feather name={icon} size={24} color={Colors.light.primary} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={styles.methodTitle}>{title}</Text>
        <Text style={styles.methodText}>{text}</Text>
      </View>
      <Feather name="chevron-right" size={22} color="#303747" />
    </PressableScale>
  );
}

function HeroWithAsset({
  asset,
  onAssetPress,
}: {
  asset: SendAssetOption;
  onAssetPress: () => void;
}) {
  return (
    <FadeInView delay={60} style={styles.heroRow}>
      <View style={styles.heroCopy}>
        <Text style={styles.title}>Top up {asset.code}</Text>
      </View>
      <AssetPill asset={asset} onPress={onAssetPress} />
    </FadeInView>
  );
}

function StaticAssetPill({ asset }: { asset: SendAssetOption }) {
  return (
    <View style={sendAmountStyles.currencyPill}>
      <AssetIcon asset={asset} size={24} />
      <Text style={sendAmountStyles.currencyCode}>{asset.code}</Text>
    </View>
  );
}

export function AddMoneyMethodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const [asset, setAsset] = useState(() => findAddMoneyAsset(params.asset));
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
            onPress={() =>
              router.push(`/add-money/stablecoin-transfer?asset=${asset.code}` as Href)
            }
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
          setAsset(nextAsset);
          setAssetPickerOpen(false);
        }}
        selectedAsset={asset}
      />
    </AddMoneyShell>
  );
}

export function AddNgnBankTransferScreen() {
  const router = useRouter();

  return (
    <AddMoneyShell>
      <TopBar />
      <FadeInView delay={60} style={styles.heroCopy}>
        <Text style={styles.title}>Add NGN via bank transfer</Text>
        <Text style={styles.subtitle}>Make a transfer to your account details below.</Text>
      </FadeInView>

      <FadeInView delay={120} style={[styles.card, styles.softCard, styles.cardRow]}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>Get a NGN bank account</Text>
          <Text style={styles.cardText}>Open a Paayee NGN account to receive local transfers.</Text>
          <PressableScale
            onPress={() => router.push('/asset/ngn/account-details' as Href)}
            style={styles.miniButton}>
            <Text style={styles.miniButtonText}>Get account details</Text>
            <Feather name="chevron-right" size={17} color={Colors.light.white} />
          </PressableScale>
        </View>
        <BankArt />
      </FadeInView>
    </AddMoneyShell>
  );
}

export function AddStablecoinTransferScreen() {
  const params = useLocalSearchParams<{ asset?: string }>();
  const asset = findAddMoneyAsset(params.asset);
  const stableAsset = isStablecoinAsset(asset)
    ? asset
    : sendAssetOptions.find((item) => item.code === 'USDC') ?? asset;
  const network = addMoneyNetworks[0];

  return (
    <AddMoneyShell>
      <TopBar />
      <FadeInView delay={60} style={styles.heroCopy}>
        <Text style={styles.title}>Add {stableAsset.code} via transfer</Text>
        <Text style={styles.subtitle}>Make a transfer to the wallet address below.</Text>
      </FadeInView>

      <FadeInView delay={110} style={styles.networkRow}>
        <View style={styles.networkPill}>
          <Feather name="link-2" size={17} color="#3D72EA" />
          <Text style={styles.networkText}>{network.shortName}</Text>
        </View>
      </FadeInView>

      <FadeInView delay={150} style={[styles.card, styles.qrCard]}>
        <View style={styles.qrBox}>
          {qrCells.map((filled, index) => (
            <View key={index} style={[styles.qrCell, filled && styles.qrCellFilled]} />
          ))}
          <View style={styles.qrLogo}>
            <Feather name="link-2" size={22} color={Colors.light.black} />
          </View>
        </View>

        <Text selectable style={styles.addressText}>
          {splitAddress(addMoneyDepositAddress)}
        </Text>

        <PressableScale style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Copy</Text>
          <Feather name="copy" size={16} color="#3D72EA" />
        </PressableScale>

        <Text style={styles.noteText}>
          Only send {stableAsset.code} on the {network.name} network to this address.
          Your deposit will appear in your {stableAsset.code} balance after confirmation.
        </Text>
      </FadeInView>

      <View style={styles.divider} />

      <FadeInView delay={190} style={styles.cardCopy}>
        <Text style={styles.aboutTitle}>About this account</Text>
        <Bullet text={`Sending any other token or network may delay your ${stableAsset.code} deposit.`} />
        <Bullet text={`${stableAsset.code} deposits on supported networks are free in this demo flow.`} />
      </FadeInView>
    </AddMoneyShell>
  );
}

export function AddMoneyConversionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const targetAsset = findAddMoneyAsset(params.asset);
  const [sourceAsset, setSourceAsset] = useState(() => getSourceAsset(targetAsset));
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const numericAmount = Number(amount || 0);
  const fee = numericAmount > 0 ? getTransferFee(sourceAsset.code) : 0;
  const amountAfterFee = Math.max(numericAmount - fee, 0);
  const receiveAmount = convertAmount(amountAfterFee, sourceAsset, targetAsset);

  return (
    <AddMoneyShell>
      <TopBar />
      <FadeInView delay={60} style={styles.heroCopy}>
        <Text style={styles.title}>Add money via conversion</Text>
        <Text style={styles.subtitle}>Enter amount and select the balance to convert from.</Text>
      </FadeInView>

      <FadeInView delay={120} style={{ gap: 20 }}>
        <Text style={sendAmountStyles.fieldLabel}>Amount to add</Text>
        <View style={sendAmountStyles.amountCard}>
          <View style={sendAmountStyles.amountTop}>
            <AssetPill asset={sourceAsset} onPress={() => setAssetPickerOpen(true)} />
            <TextInput
              value={amount ? formatMoney(numericAmount, sourceAsset) : ''}
              onChangeText={(value) => setAmount(value.replace(/\D/g, '').slice(0, 9))}
              keyboardType="number-pad"
              placeholder={`${sourceAsset.symbol}0`}
              placeholderTextColor="#B7BDC8"
              style={sendAmountStyles.amountInput}
            />
          </View>
          <Text style={sendAmountStyles.balanceHint}>
            Bal: {sourceAsset.symbol}
            {sourceAsset.balance}
          </Text>
        </View>

        <View style={sendAmountStyles.feeCard}>
          <SummaryRow label="Transaction fee" value={`- ${formatMoney(fee, sourceAsset)}`} />
          <View style={sendAmountStyles.reviewDivider} />
          <SummaryRow
            label="Amount you will receive"
            value={`= ${formatMoney(receiveAmount, targetAsset)}`}
          />
          <SummaryRow label="Today's rate" value={readRateLabel(sourceAsset, targetAsset)} />
        </View>

        <Text style={sendAmountStyles.fieldLabel}>Amount you will receive</Text>
        <View style={sendAmountStyles.receiveAmountCard}>
          <StaticAssetPill asset={targetAsset} />
          <Text style={sendAmountStyles.receiveAmount}>{formatMoney(receiveAmount, targetAsset)}</Text>
        </View>

        <View style={sendAmountStyles.arrivalHint}>
          <Feather name="zap" size={18} color="#A0A8B7" />
          <Text style={sendAmountStyles.arrivalHintText}>Usually arrives in a minute</Text>
        </View>
      </FadeInView>

      <FooterButton
        disabled={receiveAmount <= 0}
        label="Continue"
        onPress={() => router.replace(`/asset/${targetAsset.code.toLowerCase()}` as Href)}
      />

      <BalancePickerSheet
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={(nextAsset) => {
          if (nextAsset.code !== targetAsset.code) {
            setSourceAsset(nextAsset);
          }
          setAssetPickerOpen(false);
        }}
        selectedAsset={sourceAsset}
      />
    </AddMoneyShell>
  );
}

function BankArt() {
  return (
    <View style={styles.bankArt}>
      <View style={styles.bankRoof} />
      <View style={styles.bankColumns}>
        <View style={styles.bankColumn} />
        <View style={styles.bankColumn} />
        <View style={styles.bankColumn} />
      </View>
      <View style={styles.bankBase} />
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}
