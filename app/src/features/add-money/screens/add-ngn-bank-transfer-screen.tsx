import { Feather } from '@react-native-vector-icons/feather';
import * as Clipboard from 'expo-clipboard';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import {
  getKlydeConfig,
  getKlydeFundingInstructions,
  simulateKlydeFundingReceived,
  type KlydeFundingInstructions,
} from '@/integrations/klyde';

import { addMoneyStyles as styles } from '../add-money-screen.styles';
import { AddMoneyShell, TopBar } from '../components/add-money-shell';

const MAX_SIMULATED_NGN = 1_000_000;
type KlydeBankFundingInstructions = Extract<KlydeFundingInstructions, { rail: 'bank_transfer' }>;

export function AddNgnBankTransferScreen() {
  const router = useRouter();
  const [funding, setFunding] = useState<KlydeBankFundingInstructions>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const showSandboxSimulator = getKlydeConfig().environment !== 'production';

  const loadFundingInstructions = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const instructions = await getKlydeFundingInstructions({ currency: 'NGN', market: 'NG', rail: 'bank_transfer' });

      if (instructions.rail !== 'bank_transfer') {
        throw new Error('Klyde returned the wrong funding route for NGN.');
      }

      setFunding(instructions);
    } catch (fundingError) {
      setErrorMessage(formatFundingInstructionsError(fundingError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadFundingInstructions);
  }, [loadFundingInstructions]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 4500);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = setTimeout(() => setSuccessMessage(''), 2600);

    return () => clearTimeout(timeout);
  }, [successMessage]);

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
        <Text style={styles.title}>Add NGN via bank transfer</Text>
        <Text style={styles.subtitle}>Make a transfer to your account details below.</Text>
      </FadeInView>

      {loading ? (
        <FundingInstructionsSkeleton />
      ) : funding ? (
        <>
          <FundingInstructionsCard
            funding={funding}
            onCopy={async (label, value) => {
              await Clipboard.setStringAsync(value);
              setErrorMessage('');
              setSuccessMessage(`${label} copied`);
            }}
          />
          {showSandboxSimulator ? (
            <FundingSimulatorCard
              funding={funding}
              onError={(message) => {
                setSuccessMessage('');
                setErrorMessage(message);
              }}
              onTransactionCreated={(depositId, receiptId, amount) => {
                const receiptParam = receiptId ? `&receiptId=${encodeURIComponent(receiptId)}` : '';

                router.replace(
                  `/operation-success?title=${encodeURIComponent('Money received')}&amount=${encodeURIComponent(
                    `₦${amount.toLocaleString('en-US')}`,
                  )}&kind=deposit&transactionId=${encodeURIComponent(depositId)}${receiptParam}` as Href,
                );
              }}
            />
          ) : null}
        </>
      ) : (
        <FundingInstructionsEmptyState onRetry={loadFundingInstructions} />
      )}
    </AddMoneyShell>
  );
}

function FundingInstructionsEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <FadeInView delay={120} style={styles.fundingEmptyCard}>
      <View style={styles.fundingEmptyIcon}>
        <Feather name="credit-card" size={22} color={Colors.light.textSecondary} />
      </View>
      <Text style={styles.fundingEmptyTitle}>NGN funding is not ready yet</Text>
      <Text style={styles.fundingEmptyText}>
        Refresh your account details. If this keeps happening, contact support.
      </Text>
      <PressableScale onPress={onRetry} style={styles.fundingEmptyButton}>
        <Text style={styles.fundingEmptyButtonText}>Refresh details</Text>
      </PressableScale>
    </FadeInView>
  );
}

function FundingInstructionsCard({
  funding,
  onCopy,
}: {
  funding: KlydeBankFundingInstructions;
  onCopy: (label: string, value: string) => void | Promise<void>;
}) {
  return (
    <FadeInView delay={120} style={styles.fundingCard}>
      <View style={styles.fundingIcon}>
        <Feather name="credit-card" size={22} color={Colors.light.primary} />
      </View>
      <View style={styles.fundingIntro}>
        <Text style={styles.fundingTitle}>Transfer to your Paayee NGN account</Text>
        <Text style={styles.fundingText}>
          Use these details from your bank app. Your balance updates after payment confirmation.
        </Text>
      </View>

      <View style={styles.fundingRows}>
        <FundingRow label="Bank name" value={funding.bankName} onCopy={onCopy} />
        <FundingRow label="Account number" value={funding.accountNumber} emphasized onCopy={onCopy} />
        <FundingRow label="Account name" value={funding.accountName} onCopy={onCopy} />
        <FundingRow label="Reference" value={funding.reference} />
      </View>
    </FadeInView>
  );
}

function FundingSimulatorCard({
  funding,
  onError,
  onTransactionCreated,
}: {
  funding: KlydeBankFundingInstructions;
  onError: (message: string) => void;
  onTransactionCreated: (depositId: string, receiptId: string | undefined, amount: number) => void;
}) {
  const [amount, setAmount] = useState('1000');
  const [submitting, setSubmitting] = useState(false);
  const numericAmount = Number(amount || 0);
  const disabled = submitting || !Number.isFinite(numericAmount) || numericAmount <= 0;

  async function handleSimulateFunding() {
    if (numericAmount <= 0) {
      onError('Enter an amount to simulate.');
      return;
    }

    if (numericAmount > MAX_SIMULATED_NGN) {
      onError('Use ₦1,000,000 or less for a simulated transfer.');
      return;
    }

    setSubmitting(true);
    onError('');

    try {
      const result = await simulateKlydeFundingReceived({
        amount: {
          display: String(numericAmount),
          currency: 'NGN',
          minorUnits: String(Math.round(numericAmount * 100)),
          scale: 2,
        },
        provider: funding.provider,
        reference: funding.reference,
      });
      onTransactionCreated(result.deposit.id, result.deposit.receiptId, numericAmount);
    } catch (error) {
      onError(formatFundingInstructionsError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FadeInView delay={170} style={styles.simulatorCard}>
      <View style={styles.simulatorCopy}>
        <Text style={styles.simulatorTitle}>Simulate transfer received</Text>
        <Text style={styles.simulatorText}>Sandbox only. This confirms the funding flow without a real bank transfer.</Text>
      </View>
      <View style={styles.simulatorInputRow}>
        <Text style={styles.simulatorCurrency}>₦</Text>
        <TextInput
          accessibilityLabel="Simulated transfer amount"
          keyboardType="number-pad"
          maxLength={7}
          onChangeText={(value) => setAmount(value.replace(/\D/g, '').slice(0, 7))}
          placeholder="1000"
          placeholderTextColor="#A2ABBA"
          style={styles.simulatorInput}
          value={amount}
        />
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Simulate transfer received"
        disabled={disabled}
        onPress={handleSimulateFunding}
        style={[styles.simulatorButton, disabled && styles.simulatorButtonDisabled]}>
        <Text style={styles.simulatorButtonText}>{submitting ? 'Simulating...' : 'Simulate received'}</Text>
        <Feather name="arrow-right" size={16} color={Colors.light.white} />
      </PressableScale>
    </FadeInView>
  );
}

function FundingRow({
  emphasized,
  label,
  onCopy,
  value,
}: {
  emphasized?: boolean;
  label: string;
  onCopy?: (label: string, value: string) => void | Promise<void>;
  value: string;
}) {
  return (
    <View style={styles.fundingRow}>
      <Text style={styles.fundingLabel}>{label}</Text>
      <View style={styles.fundingValueRow}>
        <Text selectable numberOfLines={3} style={[styles.fundingValue, emphasized && styles.fundingValueLarge]}>
          {value}
        </Text>
        {onCopy ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}
            onPress={() => onCopy(label, value)}
            style={styles.fundingCopyButton}>
            <Feather name="copy" size={15} color="#A2ABBA" />
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

function FundingInstructionsSkeleton() {
  return (
    <FadeInView delay={120} style={styles.fundingCard}>
      <SkeletonBlock style={styles.fundingIconSkeleton} />
      <SkeletonBlock style={styles.fundingTitleSkeleton} />
      <SkeletonBlock style={styles.fundingTextSkeleton} />
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.fundingRow}>
          <SkeletonBlock style={styles.fundingLabelSkeleton} />
          <SkeletonBlock style={styles.fundingValueSkeleton} />
        </View>
      ))}
    </FadeInView>
  );
}

function formatFundingInstructionsError(error: unknown) {
  if (isFundingInstructionsAuthError(error)) {
    return 'We could not restore your money session. Please try again.';
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch failed')) {
    return 'We could not connect to funding right now. Try again.';
  }

  return message || 'Could not load your NGN account details.';
}

function isFundingInstructionsAuthError(error: unknown) {
  if (hasKlydeSessionErrorCode(error)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('authenticated user context') ||
    normalized.includes('session expired') ||
    normalized.includes('session is required') ||
    normalized.includes('unauthorized')
  );
}

function hasKlydeSessionErrorCode(error: unknown) {
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
