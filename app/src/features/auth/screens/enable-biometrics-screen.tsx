import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { setBiometricsEnabled, upsertCurrentProfile } from '@/integrations/supabase';

import { setAuthProgress } from '../auth-progress';
import { formatAuthError } from '../auth-errors';
import { authStyles as styles } from '../auth-screen.styles';
import { clearSessionLock, markReturningUser } from '../session';
import { AuthShell } from './auth-shell';

export function EnableBiometricsScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const finish = async (enabled: boolean) => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (enabled) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !enrolled) {
          throw new Error('Biometric unlock is not available on this device yet.');
        }
      }

      await SecureStore.setItemAsync('paayee_biometrics_enabled', enabled ? 'true' : 'false');
      await setBiometricsEnabled(enabled);
      await upsertCurrentProfile({ setupStep: 'completed' });
      await setAuthProgress({ step: 'complete' });
      await Promise.all([markReturningUser(), clearSessionLock()]);
      router.replace('/?authDone=1' as Href);
    } catch (error) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      showBack
      onBack={async () => {
        await setAuthProgress({ step: 'pin' });
        router.replace('/setup/pin' as Href);
      }}>
      <FadeInView delay={70} style={styles.hero}>
        <View style={styles.biometricArt}>
          <View style={styles.biometricBadge}>
            <Feather name="smile" size={48} color={Colors.light.primary} />
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.detailTitle}>Unlock faster next time</Text>
          <Text style={styles.subtitle}>
            Enable Face ID or fingerprint unlock after login. You can also keep using your PIN.
          </Text>
          <FeedbackToast message={errorMessage} tone="error" />
        </View>
      </FadeInView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          onPress={() => finish(true)}
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Saving...' : 'Enable biometrics'}
          </Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={() => finish(false)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Not now</Text>
        </PressableScale>
      </View>
    </AuthShell>
  );
}
