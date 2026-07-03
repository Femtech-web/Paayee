import { Feather } from '@react-native-vector-icons/feather';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';

import { profileStyles as styles } from '../profile-screen.styles';

type FeatherName = ComponentProps<typeof Feather>['name'];

export function SettingsRow({
  badge,
  icon,
  isLast = false,
  onPress,
  title,
}: {
  badge?: string;
  icon: FeatherName;
  isLast?: boolean;
  onPress?: () => void;
  title: string;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={Colors.light.primary} />
      </View>
      <Text style={styles.rowText}>{title}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={20} color="#B6BDCA" />
      ) : null}
    </PressableScale>
  );
}

export function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <FadeInView style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </FadeInView>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ProfileField({
  autoCapitalize,
  keyboardType,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, multiline && styles.multilineField]}>
        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor="#B7BDC8"
          style={[styles.input, multiline && styles.multilineInput]}
          value={value}
        />
      </View>
    </View>
  );
}

export function PasswordField({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={label}
          placeholderTextColor="#B7BDC8"
          style={styles.input}
        />
        <Pressable onPress={() => setVisible((next) => !next)}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={20} color="#4C5361" />
        </Pressable>
      </View>
    </View>
  );
}

export function LimitBlock({
  progress,
  remaining,
  title,
}: {
  progress: number;
  remaining: string;
  title: string;
}) {
  return (
    <View style={styles.limitListCard}>
      <Text style={styles.rowText}>{title}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 2)}%` }]} />
      </View>
      <View style={styles.limitMetaRow}>
        <Text style={styles.limitMeta}>{remaining}</Text>
        <Text style={styles.limitMeta}>Refreshes in 14 hours</Text>
      </View>
    </View>
  );
}

export function Key({ onPress, value }: { onPress: () => void; value: string }) {
  return (
    <PressableScale onPress={onPress} style={styles.key}>
      <Text style={styles.keyText}>{value}</Text>
    </PressableScale>
  );
}
