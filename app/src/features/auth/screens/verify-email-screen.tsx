import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { runtimeConfig } from '@/config/runtime';
import {
  clearKlydeSession,
  linkKlydeAccountToCurrentProfile,
  startKlydeEmailVerification,
  verifyKlydeEmail,
} from '@/integrations/klyde';
import { signOutFromSupabase } from '@/integrations/supabase';

import {
  clearAuthProgress,
  getAuthProgress,
  getAuthProgressHref,
  setAuthProgress,
  type AuthProgress,
} from '../auth-progress';
import { formatAuthError } from '../auth-errors';
import { authStyles as styles } from '../auth-screen.styles';
import { AuthShell } from './auth-shell';

export function VerifyEmailScreen() {
  const router = useRouter();
  const { challengeId, email } = useLocalSearchParams<{
    challengeId?: string;
    email?: string;
  }>();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [savedProgress, setSavedProgress] = useState<AuthProgress | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const routeEmail = email ? decodeURIComponent(email).trim().toLowerCase() : '';
  const routeChallengeId = challengeId ? decodeURIComponent(challengeId) : '';
  const normalizedEmail = routeEmail || savedProgress?.email || '';
  const normalizedChallengeId = routeChallengeId || savedProgress?.challengeId || '';
  const visibleEmail = normalizedEmail || 'your email';
  const canVerify = !runtimeConfig.realIntegrationsEnabled || code.length === 6;

  useEffect(() => {
    let mounted = true;

    getAuthProgress().then((progress) => {
      if (mounted) {
        setSavedProgress(progress);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const canResend = useMemo(
    () => runtimeConfig.realIntegrationsEnabled && Boolean(normalizedEmail) && !resending,
    [normalizedEmail, resending],
  );

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  useEffect(() => {
    if (!resendMessage) {
      return;
    }

    const timeout = setTimeout(() => setResendMessage(''), 3500);

    return () => clearTimeout(timeout);
  }, [resendMessage]);

  const continueFlow = async () => {
    if (!canVerify || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setResendMessage('');

    try {
      if (runtimeConfig.realIntegrationsEnabled) {
        if (!normalizedEmail || !normalizedChallengeId) {
          throw new Error('Start email verification again to continue.');
        }

        const result = await verifyKlydeEmail({
          challengeId: normalizedChallengeId,
          code,
          email: normalizedEmail,
        });

        await linkKlydeAccountToCurrentProfile({
          authResult: result,
          email: normalizedEmail,
        });
      }

      await setAuthProgress({ email: normalizedEmail, step: 'handle' });
      router.replace('/setup/handle' as Href);
    } catch (error) {
      setErrorMessage(formatAuthError(error, 'verify'));
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!canResend) {
      return;
    }

    setResending(true);
    setErrorMessage('');
    setResendMessage('');
    setCode('');

    try {
      const challenge = await startKlydeEmailVerification({ email: normalizedEmail });
      const progress = await setAuthProgress({
        challengeId: challenge.challengeId,
        email: normalizedEmail,
        step: 'verify-email',
      });

      setSavedProgress(progress);
      setResendMessage('We sent a new code.');
      router.replace(getAuthProgressHref(progress));
    } catch (error) {
      setErrorMessage(formatAuthError(error, 'verify'));
    } finally {
      setResending(false);
    }
  };

  const useAnotherEmail = async () => {
    setErrorMessage('');
    setResendMessage('');

    try {
      await Promise.all([clearAuthProgress(), clearKlydeSession(), signOutFromSupabase()]);
    } finally {
      router.replace('/auth/signup?fresh=1' as Href);
    }
  };

  return (
    <AuthShell showBack onBack={useAnotherEmail}>
      <FadeInView delay={50} style={styles.hero}>
        <View style={styles.copy}>
          <Text style={styles.detailTitle}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to {visibleEmail}. Enter the code to continue setting up
            your account.
          </Text>
        </View>
        <FeedbackToast message={errorMessage} tone="error" />
        <View style={styles.emailPill}>
          <Text numberOfLines={1} style={styles.emailPillText}>
            {visibleEmail}
          </Text>
        </View>
        <View style={styles.verificationBoxes}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View key={index} style={styles.verificationBox}>
              <Text style={styles.verificationDigit}>{code[index] ?? ''}</Text>
            </View>
          ))}
        </View>
        <TextInput
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            setErrorMessage('');
          }}
          style={styles.hiddenInput}
          textContentType="oneTimeCode"
          value={code}
        />
        <FeedbackToast message={resendMessage} tone="success" />
      </FadeInView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Verify email"
          onPress={canVerify && !submitting ? continueFlow : undefined}
          style={[styles.primaryButton, (!canVerify || submitting) && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Verifying...' : 'Verify email'}</Text>
        </PressableScale>
        <Text style={styles.inlineText}>
          Did not get it?{' '}
          <Text onPress={canResend ? resendCode : undefined} style={styles.inlineAction}>
            {resending ? 'Sending...' : 'Resend code'}
          </Text>
        </Text>
      </View>
    </AuthShell>
  );
}
