import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { Colors } from '@/constants/theme';
import {
  getKlydeTransactionLimits,
  type KlydeTransactionLimit,
  type KlydeTransactionLimitAction,
  type KlydeTransactionLimits,
  type MoneyAmount,
} from '@/integrations/klyde/client';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { LimitBlock, SettingsRow } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function TransactionLimitsScreen() {
  const router = useRouter();

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Transaction limits</Text>
      </FadeInView>
      <View style={styles.sectionCard}>
        <SettingsRow
          icon="arrow-up-right"
          title="Withdrawal limits"
          onPress={() => router.push('/profile/limits/withdrawal' as Href)}
        />
        <SettingsRow
          icon="arrow-down-left"
          title="Deposit limits"
          isLast
          onPress={() => router.push('/profile/limits/deposit' as Href)}
        />
      </View>
    </ProfileShell>
  );
}

export function WithdrawalLimitsScreen() {
  return (
    <LimitDetailScreen
      action="withdrawal"
      title="Withdrawal limits"
      subtitle="Limits for sending money from balances to any recipient."
    />
  );
}

export function DepositLimitsScreen() {
  return (
    <LimitDetailScreen
      action="deposit"
      title="Deposit limits"
      subtitle="Limits for making payments into balances."
    />
  );
}

function LimitDetailScreen({
  action,
  subtitle,
  title,
}: {
  action: KlydeTransactionLimitAction;
  subtitle: string;
  title: string;
}) {
  const [limits, setLimits] = useState<KlydeTransactionLimits>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    getKlydeTransactionLimits({ baseCurrency: 'NGN' })
      .then((response) => {
        if (mounted) {
          setLimits(response);
        }
      })
      .catch(() => {
        if (mounted) {
          setErrorMessage('Could not load your current limits.');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const actionLimits = useMemo(
    () => limits?.limits.filter((limit) => limit.action === action) ?? [],
    [action, limits?.limits],
  );
  const riskCopy = createRiskCopy(limits);

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </FadeInView>

      <FadeInView delay={95} style={styles.noteCard}>
        <Feather name="info" size={18} color={Colors.light.primary} />
        <Text style={styles.noteText}>{riskCopy}</Text>
      </FadeInView>

      <FadeInView delay={110} style={styles.detailCard}>
        {loading ? (
          <LimitBlock title="Loading limits" remaining="Checking your account" progress={0} />
        ) : null}
        {!loading && errorMessage ? (
          <Text style={[styles.noteText, { color: Colors.light.error }]}>{errorMessage}</Text>
        ) : null}
        {!loading && !errorMessage && actionLimits.length === 0 ? (
          <Text style={styles.noteText}>No active {title.toLowerCase()} apply to this account yet.</Text>
        ) : null}
        {actionLimits.map((limit) => (
          <LimitBlock
            key={`${limit.action}-${limit.currency}-${limit.scope}`}
            title={`${formatLimitScope(limit.scope)} limit: ${formatMoneyAmount(limit.limit)}`}
            remaining={`${formatMoneyAmount(limit.remaining)} remaining`}
            progress={calculateLimitProgress(limit)}
            resetLabel={formatResetLabel(limit)}
          />
        ))}
      </FadeInView>
    </ProfileShell>
  );
}

function createRiskCopy(limits?: KlydeTransactionLimits): string {
  if (!limits) {
    return 'Limits are checked live before each money movement.';
  }

  if (limits.riskStatus === 'restricted' || limits.riskStatus === 'blocked') {
    return 'Some account actions are restricted right now. Contact support if this looks wrong.';
  }

  if (limits.kycStatus === 'approved') {
    return 'Your verified account limits are applied automatically before each transaction.';
  }

  return 'Basic account limits apply until account verification is complete.';
}

function formatLimitScope(scope: KlydeTransactionLimit['scope']): string {
  if (scope === 'single_transaction') {
    return 'Single transaction';
  }

  return titleCase(scope);
}

function calculateLimitProgress(limit: KlydeTransactionLimit): number {
  const used = parseMoneyAmount(limit.used);
  const maximum = parseMoneyAmount(limit.limit);

  if (!Number.isFinite(used) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }

  return Math.min(Math.max(used / maximum, 0), 1);
}

function formatResetLabel(limit: KlydeTransactionLimit): string {
  if (!limit.resetsAt) {
    return limit.status === 'available' ? 'Available now' : titleCase(limit.status.replace(/_/g, ' '));
  }

  const resetDate = new Date(limit.resetsAt);
  if (Number.isNaN(resetDate.getTime())) {
    return 'Refreshes soon';
  }

  return `Refreshes ${new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(resetDate)}`;
}

function formatMoneyAmount(amount: MoneyAmount): string {
  const numericAmount = parseMoneyAmount(amount);
  const symbol = getCurrencySymbol(amount.currency);

  if (Number.isFinite(numericAmount)) {
    return `${symbol}${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
    }).format(numericAmount)}`;
  }

  return `${symbol}${amount.display}`;
}

function parseMoneyAmount(amount: MoneyAmount): number {
  if (amount.minorUnits && amount.scale !== undefined) {
    return Number(amount.minorUnits) / 10 ** amount.scale;
  }

  return Number(amount.display.replace(/,/g, ''));
}

function getCurrencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'NGN':
      return '₦';
    case 'USD':
    case 'USDC':
    case 'USDT':
      return '$';
    default:
      return `${currency.toUpperCase()} `;
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
