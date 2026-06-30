import { Feather } from '@react-native-vector-icons/feather';
import { Image, Pressable, Text, View } from 'react-native';

import UsdcLogo from '../../../../../assets/icons/usdc.svg';
import UsdtLogo from '../../../../../assets/icons/usdt.svg';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { type SendAssetOption, type SendRecipient } from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';

const nigeriaFlag = require('../../../../../assets/images/nigeria.png');

export function SendMethod({
  icon,
  title,
  text,
  onPress,
  soon = false,
}: {
  icon: 'at-sign' | 'home' | 'link-2';
  title: string;
  text: string;
  onPress?: () => void;
  soon?: boolean;
}) {
  return (
    <PressableScale onPress={soon ? undefined : onPress} style={styles.methodRow}>
      <View style={styles.methodIcon}>
        <Feather name={icon} size={24} color={soon ? '#AAB2BF' : Colors.light.primary} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={[styles.methodTitle, soon && styles.disabledText]}>{title}</Text>
        <Text style={[styles.methodText, soon && styles.disabledText]}>{text}</Text>
      </View>
      {soon ? (
        <View style={styles.disabledPill}>
          <Text style={styles.disabledPillText}>Soon</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={22} color="#303747" />
      )}
    </PressableScale>
  );
}

export function EmptyRecipients() {
  return (
    <View style={styles.emptyRecipients}>
      <View style={styles.emptyIcon}>
        <Feather name="users" size={38} color="#B9C0CD" />
      </View>
      <Text style={styles.emptyText}>No recent recipients to show</Text>
    </View>
  );
}

export function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Feather name="globe" size={17} color={active ? Colors.light.primary : '#8A94A8'} />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </View>
  );
}

export function RecipientRow({
  recipient,
  onPress,
}: {
  recipient: SendRecipient;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.recipientRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{recipient.initials}</Text>
      </View>
      <View style={styles.recipientCopy}>
        <Text numberOfLines={1} style={styles.recipientName}>
          {recipient.name}
        </Text>
        <Text numberOfLines={1} style={styles.recipientMeta}>
          {recipient.bankName} · {recipient.accountNumber}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#B6BDCA" />
    </PressableScale>
  );
}

export function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function FooterButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      style={[styles.footerButton, disabled && styles.footerButtonDisabled]}>
      <Text style={[styles.footerButtonText, disabled && styles.footerButtonTextDisabled]}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function AssetPill({ asset, onPress }: { asset: SendAssetOption; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.currencyPill}>
      <AssetIcon asset={asset} size={24} />
      <Text style={styles.currencyCode}>{asset.code}</Text>
      <Feather name="chevron-down" size={18} color="#202633" />
    </Pressable>
  );
}

export function AssetIcon({ asset, size }: { asset: SendAssetOption; size: number }) {
  if (asset.code === 'NGN') {
    return <Image source={nigeriaFlag} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  if (asset.code === 'USDC') {
    return <UsdcLogo width={size} height={size} />;
  }

  return <UsdtLogo width={size} height={size} />;
}

export function RecipientHeader({ recipient }: { recipient: SendRecipient & { firstName: string } }) {
  const meta = [recipient.bankName, recipient.accountNumber].filter(Boolean).join(' · ');

  return (
    <View style={styles.recipientRow}>
      <View style={styles.recipientCopy}>
        <Text style={styles.recipientName}>{recipient.name}</Text>
        <Text style={styles.recipientMeta}>{meta}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{recipient.initials}</Text>
      </View>
    </View>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}
