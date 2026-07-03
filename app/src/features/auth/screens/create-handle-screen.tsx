import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { upsertCurrentProfile } from '@/integrations/supabase';

import { setAuthProgress } from '../auth-progress';
import { formatAuthError } from '../auth-errors';
import { authStyles as styles } from '../auth-screen.styles';
import { AuthShell } from './auth-shell';

export function CreateHandleScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const [handle, setHandle] = useState('jadesola');
  const [submitting, setSubmitting] = useState(false);
  const validHandle = handle.length >= 3;

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const continueFlow = async () => {
    if (!validHandle || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await upsertCurrentProfile({ handle, setupStep: 'handle_created' });
      await setAuthProgress({ step: 'pin' });
      router.replace('/setup/pin' as Href);
    } catch (error) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <FadeInView delay={50} style={styles.copy}>
        <Text style={styles.detailTitle}>Choose your Paayee handle</Text>
        <Text style={styles.subtitle}>
          People can use this to send you private payments without needing your wallet address.
        </Text>
      </FadeInView>
      <FeedbackToast message={errorMessage} tone="error" />
      <FadeInView delay={90} style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Paayee handle</Text>
          <View style={styles.field}>
            <Feather name="at-sign" size={19} color="#687184" />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => {
                setHandle(value.replace(/[^a-z0-9_]/gi, '').toLowerCase());
                setErrorMessage('');
              }}
              placeholder="yourname"
              placeholderTextColor="#B7BDC8"
              style={styles.input}
              value={handle}
            />
          </View>
          <Text style={styles.hint}>Your public handle will be @{handle || 'yourname'}.</Text>
        </View>
      </FadeInView>
      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Continue to PIN setup"
          onPress={validHandle && !submitting ? continueFlow : undefined}
          style={[styles.primaryButton, (!validHandle || submitting) && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Saving...' : 'Continue'}</Text>
        </PressableScale>
      </View>
    </AuthShell>
  );
}
