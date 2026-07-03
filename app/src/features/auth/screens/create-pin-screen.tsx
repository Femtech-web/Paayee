import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { setPinEnabled, upsertCurrentProfile } from '@/integrations/supabase';

import { setAuthProgress } from '../auth-progress';
import { formatAuthError } from '../auth-errors';
import { authStyles as styles } from '../auth-screen.styles';
import { storePinVerifier } from '../pin-security';
import { AuthShell } from './auth-shell';

export function CreatePinScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const [pin, setPin] = useState('');
  const [confirmedPin, setConfirmedPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [submitting, setSubmitting] = useState(false);
  const activePin = step === 'create' ? pin : confirmedPin;
  const canContinue = activePin.length === 4 && !submitting;

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const continueFlow = async () => {
    if (!canContinue) {
      return;
    }

    if (step === 'create') {
      setStep('confirm');
      setErrorMessage('');
      return;
    }

    if (confirmedPin !== pin) {
      setConfirmedPin('');
      setErrorMessage('Those PINs did not match. Try the confirmation again.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await storePinVerifier(pin);
      await setPinEnabled();
      await upsertCurrentProfile({ setupStep: 'pin_created' });
      await setAuthProgress({ step: 'biometrics' });
      router.replace('/setup/biometrics' as Href);
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
        await setAuthProgress({ step: 'handle' });
        router.replace('/setup/handle' as Href);
      }}>
      <FadeInView delay={50} style={styles.copy}>
        <Text style={styles.detailTitle}>{step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}</Text>
        <Text style={styles.subtitle}>
          {step === 'create'
            ? 'Choose a 4-digit PIN for unlocking Paayee and approving sensitive actions.'
            : 'Re-enter the same PIN so we know it was typed correctly.'}
        </Text>
      </FadeInView>
      <FeedbackToast message={errorMessage} tone="error" />
      <FadeInView delay={90} style={styles.form}>
        <View style={styles.pinBoxes}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.pinBox}>
              {activePin.length > index ? <View style={styles.pinDot} /> : null}
            </View>
          ))}
        </View>
        <TextInput
          autoFocus
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(value) => {
            const nextPin = value.replace(/\D/g, '').slice(0, 4);
            if (step === 'create') {
              setPin(nextPin);
            } else {
              setConfirmedPin(nextPin);
            }
            setErrorMessage('');
          }}
          style={{ height: 1, opacity: 0 }}
          value={activePin}
        />
      </FadeInView>
      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Continue to biometric setup"
          onPress={canContinue ? continueFlow : undefined}
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Saving...' : step === 'create' ? 'Continue' : 'Confirm PIN'}
          </Text>
        </PressableScale>
        {step === 'confirm' ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Choose a different PIN"
            onPress={() => {
              setStep('create');
              setPin('');
              setConfirmedPin('');
              setErrorMessage('');
            }}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Choose a different PIN</Text>
          </PressableScale>
        ) : null}
      </View>
    </AuthShell>
  );
}
