import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { profileUser as user } from '@/features/profile/profile-data';

import { formatAuthError } from '../auth-errors';
import { authStyles as styles } from '../auth-screen.styles';
import { verifyPin } from '../pin-security';
import { clearSessionLock, getBiometricsEnabled, signOutCurrentUser } from '../session';
import { AuthShell } from './auth-shell';

const digits = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export function UnlockScreen() {
  const router = useRouter();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finishUnlock = useCallback(async () => {
    await clearSessionLock();
    router.replace('/?authDone=1' as Href);
  }, [router]);

  const unlockWithBiometrics = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const result = await LocalAuthentication.authenticateAsync({
        cancelLabel: 'Use PIN',
        promptMessage: 'Unlock Paayee',
      });

      if (!result.success) {
        throw new Error('Biometric unlock was cancelled.');
      }

      await finishUnlock();
    } catch (error) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const unlockWithPin = useCallback(async (nextPin: string) => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const verified = await verifyPin(nextPin);

      if (!verified) {
        setPin('');
        setErrorMessage('That PIN is not correct. Try again.');
        return;
      }

      await finishUnlock();
    } catch (error) {
      setPin('');
      setErrorMessage(formatAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }, [finishUnlock, submitting]);

  useEffect(() => {
    let mounted = true;

    getBiometricsEnabled().then((enabled) => {
      if (mounted) {
        setBiometricsEnabled(enabled);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const appendDigit = (digit: string) => {
    if (submitting) {
      return;
    }

    const nextPin = `${pin}${digit}`.slice(0, 4);

    setPin(nextPin);

    if (nextPin.length === 4) {
      unlockWithPin(nextPin);
    }
  };

  const logOut = async () => {
    await signOutCurrentUser();
    router.replace('/auth/login' as Href);
  };

  return (
    <AuthShell showTopBar={false}>
      <FadeInView delay={50} style={styles.unlockHeader}>
        <View style={styles.unlockAvatar}>
          <Text style={styles.unlockAvatarText}>{user.initials}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.detailTitle}>Welcome back, {user.firstName}</Text>
          <Text style={styles.subtitle}>Enter your 4-digit PIN</Text>
        </View>
      </FadeInView>

      <FeedbackToast floating message={errorMessage} tone="error" />

      <FadeInView delay={80} style={styles.unlockBody}>
        <View style={styles.unlockPinBoxes}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.pinBox}>
              {pin.length > index ? <View style={styles.pinDot} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.keypad}>
          {digits.map((row) => (
            <View key={row.join('')} style={styles.keypadRow}>
              {row.map((digit) => (
                <UnlockKey
                  key={digit}
                  value={digit}
                  onPress={() => appendDigit(digit)}
                />
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            {biometricsEnabled ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Unlock with biometrics"
                onPress={unlockWithBiometrics}
                style={styles.key}>
                <Feather name="user-check" size={27} color="#4C5361" />
              </PressableScale>
            ) : (
              <View style={styles.key} />
            )}
            <UnlockKey value="0" onPress={() => appendDigit('0')} />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Delete PIN digit"
              onPress={() => setPin((current) => current.slice(0, -1))}
              style={styles.key}>
              <Feather name="chevron-left" size={34} color={Colors.light.error} />
            </PressableScale>
          </View>
        </View>
      </FadeInView>

      <View style={styles.unlockFooter}>
        <Text style={styles.inlineText}>
          Not your account?{' '}
          <Text onPress={logOut} style={styles.inlineAction}>
            Log out
          </Text>
        </Text>
      </View>
    </AuthShell>
  );
}

function UnlockKey({ onPress, value }: { onPress: () => void; value: string }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Enter ${value}`}
      onPress={onPress}
      style={styles.key}>
      <Text style={styles.keyText}>{value}</Text>
    </PressableScale>
  );
}
