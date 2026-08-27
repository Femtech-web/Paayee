import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { storePinVerifier, verifyPin } from '@/features/auth/pin-security';
import { setBiometricsEnabled, setPinEnabled } from '@/integrations/supabase';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { Key } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function BiometricUnlockScreen() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [hasHardware, enrolled, storedPreference] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync('paayee_biometrics_enabled'),
      ]);

      if (!mounted) {
        return;
      }

      setAvailable(hasHardware && enrolled);
      setEnabled(storedPreference === 'true');
    }

    load().catch(() => {
      if (mounted) {
        setAvailable(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const updateBiometrics = async (nextEnabled: boolean) => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (nextEnabled) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !enrolled) {
          throw new Error('Biometric unlock is not available on this device yet.');
        }

        const result = await LocalAuthentication.authenticateAsync({
          cancelLabel: 'Not now',
          promptMessage: 'Enable biometric unlock for Paayee',
        });

        if (!result.success) {
          throw new Error('Biometric confirmation was cancelled.');
        }
      }

      await SecureStore.setItemAsync('paayee_biometrics_enabled', nextEnabled ? 'true' : 'false');
      await setBiometricsEnabled(nextEnabled);
      setEnabled(nextEnabled);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update biometric unlock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Biometric unlock</Text>
        <Text style={styles.subtitle}>
          Use Face ID or fingerprint unlock after login. Your PIN remains the fallback for sensitive actions.
        </Text>
      </FadeInView>

      <FadeInView delay={100} style={styles.detailCard}>
        <View style={styles.securityHero}>
          <View style={styles.securityIcon}>
            <Feather name="shield" size={28} color={Colors.light.primary} />
          </View>
          <View style={styles.securityCopy}>
            <Text style={styles.rowText}>{enabled ? 'Biometrics are on' : 'Biometrics are off'}</Text>
            <Text style={styles.noteText}>
              {available === false
                ? 'Set up Face ID or fingerprint on this device first.'
                : 'You can change this anytime from More.'}
            </Text>
          </View>
        </View>
      </FadeInView>

      <PressableScale
        onPress={() => updateBiometrics(!enabled)}
        style={[
          styles.primaryButton,
          (available === false || submitting) && styles.primaryButtonDisabled,
        ]}>
        <Text style={styles.primaryButtonText}>
          {submitting ? 'Updating...' : enabled ? 'Turn off biometrics' : 'Enable biometrics'}
        </Text>
      </PressableScale>
      {errorMessage ? <Text style={[styles.subtitle, { color: Colors.light.error }]}>{errorMessage}</Text> : null}
    </ProfileShell>
  );
}

export function ChangePinIntroScreen() {
  const router = useRouter();

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={80} style={styles.pinIntro}>
        <View style={styles.pinArt}>
          <Text style={styles.pinArtText}>****</Text>
        </View>
        <Text style={styles.pinTitle}>One PIN for every Paayee action</Text>
        <Text style={styles.pinText}>
          You will use this PIN to approve sensitive actions and keep your account easy to access.
        </Text>
      </FadeInView>
      <PressableScale
        onPress={() => router.push('/profile/security/pin/current' as Href)}
        style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Proceed to change your PIN</Text>
      </PressableScale>
    </ProfileShell>
  );
}

export function CurrentPinScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const continueFlow = async () => {
    if (pin.length < 4 || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const verified = await verifyPin(pin);
      if (!verified) {
        setPin('');
        setErrorMessage('That PIN is not correct. Try again.');
        return;
      }

      router.push('/profile/security/pin/new' as Href);
    } catch (error) {
      setPin('');
      setErrorMessage(error instanceof Error ? error.message : 'Could not verify PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={80} style={styles.pinPad}>
        <View style={styles.hero}>
          <Text style={[styles.detailTitle, { textAlign: 'center' }]}>Enter your current PIN</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>Enter your existing 4-digit code.</Text>
          {errorMessage ? (
            <Text style={[styles.subtitle, { color: Colors.light.error, textAlign: 'center' }]}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
        <View style={styles.pinBoxes}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.pinBox}>
              {pin.length > index ? <View style={styles.pinDot} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row) => (
            <View key={row.join('')} style={styles.keypadRow}>
              {row.map((key) => (
                <Key key={key} value={key} onPress={() => setPin((next) => `${next}${key}`.slice(0, 4))} />
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            <View style={styles.key} />
            <Key value="0" onPress={() => setPin((next) => `${next}0`.slice(0, 4))} />
            <PressableScale onPress={() => setPin((next) => next.slice(0, -1))} style={styles.key}>
              <Feather name="delete" size={24} color={Colors.light.error} />
            </PressableScale>
          </View>
        </View>
      </FadeInView>
      <PressableScale
        onPress={pin.length === 4 && !submitting ? continueFlow : undefined}
        style={[styles.primaryButton, (pin.length < 4 || submitting) && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{submitting ? 'Checking...' : 'Continue'}</Text>
      </PressableScale>
    </ProfileShell>
  );
}

export function NewPinScreen() {
  const router = useRouter();
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [submitting, setSubmitting] = useState(false);
  const activePin = step === 'create' ? pin : confirmPin;
  const title = step === 'create' ? 'Create your new PIN' : 'Confirm your new PIN';
  const subtitle =
    step === 'create'
      ? 'Choose a 4-digit code you will use to unlock Paayee and approve sensitive actions.'
      : 'Enter the same code once more so we know it is right.';

  const appendDigit = (digit: string) => {
    setErrorMessage('');

    if (step === 'create') {
      setPin((next) => `${next}${digit}`.slice(0, 4));
      return;
    }

    setConfirmPin((next) => `${next}${digit}`.slice(0, 4));
  };

  const removeDigit = () => {
    setErrorMessage('');

    if (step === 'create') {
      setPin((next) => next.slice(0, -1));
      return;
    }

    setConfirmPin((next) => next.slice(0, -1));
  };

  const continueFlow = async () => {
    if (activePin.length < 4 || submitting) {
      return;
    }

    if (step === 'create') {
      setStep('confirm');
      return;
    }

    if (pin !== confirmPin) {
      setConfirmPin('');
      setErrorMessage('PINs did not match. Enter it again.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await storePinVerifier(pin);
      await setPinEnabled();
      router.replace('/profile' as Href);
    } catch (error) {
      setPin('');
      setConfirmPin('');
      setStep('create');
      setErrorMessage(error instanceof Error ? error.message : 'Could not update your PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={80} style={styles.pinPad}>
        <View style={styles.hero}>
          <Text style={[styles.detailTitle, { textAlign: 'center' }]}>{title}</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>{subtitle}</Text>
          {errorMessage ? (
            <Text style={[styles.subtitle, { color: Colors.light.error, textAlign: 'center' }]}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
        <View style={styles.pinBoxes}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.pinBox}>
              {activePin.length > index ? <View style={styles.pinDot} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row) => (
            <View key={row.join('')} style={styles.keypadRow}>
              {row.map((key) => (
                <Key key={key} value={key} onPress={() => appendDigit(key)} />
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            <View style={styles.key} />
            <Key value="0" onPress={() => appendDigit('0')} />
            <PressableScale onPress={removeDigit} style={styles.key}>
              <Feather name="delete" size={24} color={Colors.light.error} />
            </PressableScale>
          </View>
        </View>
      </FadeInView>
      <PressableScale
        onPress={activePin.length === 4 && !submitting ? continueFlow : undefined}
        style={[styles.primaryButton, (activePin.length < 4 || submitting) && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>
          {submitting ? 'Saving...' : step === 'create' ? 'Continue' : 'Save PIN'}
        </Text>
      </PressableScale>
    </ProfileShell>
  );
}
