import { Feather } from '@react-native-vector-icons/feather';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { AssetIcon, AssetPill } from '@/features/send/flows/shared/send-ui';
import type { SendAssetOption } from '@/features/send/send-data';
import { sendStyles as sendAmountStyles } from '@/features/send/send-screen.styles';

import { addMoneyStyles as styles } from '../add-money-screen.styles';

type FeatherName = ComponentProps<typeof Feather>['name'];

export const qrCells = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return row === 0 || col === 0 || row === 8 || col === 8 || (row * 2 + col) % 4 === 0 || row === col;
});

export function splitAddress(address: string) {
  const middle = Math.ceil(address.length / 2);

  return `${address.slice(0, middle)}\n${address.slice(middle)}`;
}

export function MethodRow({
  badge,
  disabled = false,
  icon,
  onPress,
  text,
  title,
}: {
  badge?: string;
  disabled?: boolean;
  icon: FeatherName;
  onPress: () => void;
  text: string;
  title: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.methodRow, disabled && styles.methodRowDisabled]}>
      <View style={[styles.methodIcon, disabled && styles.methodIconDisabled]}>
        <Feather name={icon} size={24} color={disabled ? '#A4A8B0' : Colors.light.primary} />
      </View>
      <View style={styles.methodCopy}>
        <View style={styles.methodTitleRow}>
          <Text style={[styles.methodTitle, disabled && styles.methodTitleDisabled]}>{title}</Text>
          {badge ? (
            <View style={styles.methodBadge}>
              <Text style={styles.methodBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.methodText}>{text}</Text>
      </View>
      {!disabled ? <Feather name="chevron-right" size={22} color="#303747" /> : null}
    </PressableScale>
  );
}

export function HeroWithAsset({
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

export function StaticAssetPill({ asset }: { asset: SendAssetOption }) {
  return (
    <View style={sendAmountStyles.currencyPill}>
      <AssetIcon asset={asset} size={24} />
      <Text style={sendAmountStyles.currencyCode}>{asset.code}</Text>
    </View>
  );
}

export function BankArt() {
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

export function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}
