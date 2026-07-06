import { Feather } from '@react-native-vector-icons/feather';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/features/app-data';
import {
  type DisplayCurrency,
  useDisplayCurrencyPreference,
} from '@/features/preferences/display-currency-preference';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { SettingsRow } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

const options: Array<{
  currency: DisplayCurrency;
  description: string;
  title: string;
}> = [
  {
    currency: 'NGN',
    description: 'Show your total balance in Nigerian Naira.',
    title: 'Nigerian Naira',
  },
  {
    currency: 'USD',
    description: 'Show your total balance in US dollars.',
    title: 'US Dollar',
  },
];

export function DisplayCurrencyScreen() {
  const { currency, loading, setCurrency } = useDisplayCurrencyPreference();
  const { refresh } = useAppData();
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submittingCurrency, setSubmittingCurrency] = useState<DisplayCurrency>();

  useEffect(() => {
    if (!feedback && !errorMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setFeedback('');
      setErrorMessage('');
    }, 3500);

    return () => clearTimeout(timeout);
  }, [errorMessage, feedback]);

  const updateCurrency = async (nextCurrency: DisplayCurrency) => {
    if (loading || submittingCurrency || nextCurrency === currency) {
      return;
    }

    setSubmittingCurrency(nextCurrency);
    setFeedback('');
    setErrorMessage('');

    try {
      await setCurrency(nextCurrency);
      await refresh({ silent: true });
      setFeedback(`Total balance will now show in ${nextCurrency}.`);
    } catch {
      setErrorMessage('Could not update your balance display. Try again.');
    } finally {
      setSubmittingCurrency(undefined);
    }
  };

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Total balance currency</Text>
        <Text style={styles.subtitle}>
          Choose the currency Paayee uses for your total balance. Your individual balances stay in their own currencies.
        </Text>
      </FadeInView>

      <FadeInView delay={110} style={styles.sectionCard}>
        {options.map((option, index) => {
          const selected = option.currency === currency;
          const submitting = submittingCurrency === option.currency;

          return (
            <View key={option.currency} style={index < options.length - 1 ? styles.rowBorder : undefined}>
              <SettingsRow
                icon={option.currency === 'USD' ? 'dollar-sign' : undefined}
                iconText={option.currency === 'NGN' ? '₦' : undefined}
                title={option.title}
                badge={selected ? 'selected' : option.currency}
                isLast
                onPress={() => updateCurrency(option.currency)}
              />
              <View style={styles.preferenceMetaRow}>
                <Text style={styles.preferenceMeta}>{option.description}</Text>
                {selected ? (
                  <Feather name="check-circle" size={18} color={Colors.light.success} />
                ) : submitting ? (
                  <Text style={styles.preferenceMeta}>Saving...</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </FadeInView>

      <View style={styles.footer}>
        <FeedbackToast message={feedback} tone="success" />
        <FeedbackToast message={errorMessage} tone="error" />
      </View>
    </ProfileShell>
  );
}
