import { useLoginWithEmail } from '@privy-io/expo';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';

import { clearAuthProgress, getAuthProgress, setAuthProgress } from '../auth-progress';
import { authStyles as styles } from '../auth-screen.styles';
import { completePrivySignIn } from '../session';
import { AuthShell } from './auth-shell';

export function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pending, setPending] = useState<'verify' | 'resend'>();
  const { loginWithCode, sendCode } = useLoginWithEmail();
  const routeEmail = email ? decodeURIComponent(email).trim().toLowerCase() : '';
  const normalizedEmail = routeEmail || savedEmail;

  useEffect(() => {
    getAuthProgress().then((progress) => setSavedEmail(progress?.email ?? ''));
  }, []);

  async function verify() {
    if (code.length !== 6 || !normalizedEmail || pending) return;
    setPending('verify');
    setErrorMessage('');

    try {
      const user = await loginWithCode({ code, email: normalizedEmail });
      if (user) router.replace(await completePrivySignIn(user));
    } catch (error) {
      setErrorMessage(codeMessage(error));
    } finally {
      setPending(undefined);
    }
  }

  async function resend() {
    if (!normalizedEmail || pending) return;
    setPending('resend');
    setCode('');
    setMessage('');
    setErrorMessage('');

    try {
      await sendCode({ email: normalizedEmail });
      await setAuthProgress({ email: normalizedEmail, step: 'verify-email' });
      setMessage('A new code is on its way.');
    } catch (error) {
      setErrorMessage(codeMessage(error));
    } finally {
      setPending(undefined);
    }
  }

  async function useAnotherEmail() {
    await clearAuthProgress();
    router.replace('/auth/login?fresh=1' as Href);
  }

  const canVerify = code.length === 6 && Boolean(normalizedEmail) && !pending;

  return (
    <AuthShell showBack onBack={useAnotherEmail}>
      <FadeInView delay={50} style={styles.hero}>
        <View style={styles.copy}>
          <Text style={styles.detailTitle}>Check your email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit security code sent to {normalizedEmail || 'your email'}.
          </Text>
        </View>

        <FeedbackToast message={errorMessage} tone="error" />
        <View style={styles.emailPill}>
          <Text numberOfLines={1} style={styles.emailPillText}>
            {normalizedEmail || 'your email'}
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
          onSubmitEditing={verify}
          style={styles.hiddenInput}
          textContentType="oneTimeCode"
          value={code}
        />
        <FeedbackToast message={message} tone="success" />
      </FadeInView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={canVerify ? verify : undefined}
          style={[styles.primaryButton, !canVerify && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>
            {pending === 'verify' ? 'Signing you in…' : 'Continue'}
          </Text>
        </PressableScale>
        <Text style={styles.inlineText}>
          Didn’t get it?{' '}
          <Text onPress={!pending ? resend : undefined} style={styles.inlineAction}>
            {pending === 'resend' ? 'Sending…' : 'Send another code'}
          </Text>
        </Text>
      </View>
    </AuthShell>
  );
}

function codeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('expired')) return 'That code expired. Send a new one and try again.';
  if (message.includes('invalid') || message.includes('code')) return 'That code is not correct. Try again.';
  return 'We could not complete sign-in. Please try again.';
}
