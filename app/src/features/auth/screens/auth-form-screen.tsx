import { useLoginWithEmail, useLoginWithOAuth } from '@privy-io/expo';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';

import { clearAuthProgress, setAuthProgress } from '../auth-progress';
import { authStyles as styles } from '../auth-screen.styles';
import { completePrivySignIn } from '../session';
import { AuthShell } from './auth-shell';

type AuthMode = 'signup' | 'login';

export function AuthFormScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { entry, fresh } = useLocalSearchParams<{ entry?: string; fresh?: string }>();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pending, setPending] = useState<'email' | 'google'>();
  const normalizedEmail = email.trim().toLowerCase();
  const { sendCode } = useLoginWithEmail();
  const { login } = useLoginWithOAuth();

  useEffect(() => {
    if (fresh === '1') void clearAuthProgress();
  }, [fresh]);

  async function continueWithEmail() {
    if (!normalizedEmail.includes('@') || pending) return;
    setPending('email');
    setErrorMessage('');

    try {
      await sendCode({ email: normalizedEmail });
      await setAuthProgress({ email: normalizedEmail, step: 'verify-email' });
      router.push(`/auth/verify?email=${encodeURIComponent(normalizedEmail)}` as Href);
    } catch (error) {
      setErrorMessage(authMessage(error));
    } finally {
      setPending(undefined);
    }
  }

  async function continueWithGoogle() {
    if (pending) return;
    setPending('google');
    setErrorMessage('');

    try {
      const user = await login({ provider: 'google', redirectUri: '/' });
      if (user) router.replace(await completePrivySignIn(user));
    } catch (error) {
      setErrorMessage(authMessage(error));
    } finally {
      setPending(undefined);
    }
  }

  const canContinue = normalizedEmail.includes('@') && !pending;

  return (
    <AuthShell showBack={entry === 'welcome'} showBrand={false}>
      <FadeInView delay={50} style={styles.copy}>
        <Text style={styles.detailTitle}>{mode === 'signup' ? 'Create your Paayee account' : 'Welcome back'}</Text>
        <Text style={styles.subtitle}>
          Sign in with Google or your email. No password to remember, and Paayee handles the rest.
        </Text>
      </FadeInView>

      <FeedbackToast message={errorMessage} tone="error" />

      <FadeInView delay={90} style={[styles.form, styles.authPanel]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          onPress={!pending ? continueWithGoogle : undefined}
          style={[styles.providerButton, pending && styles.primaryButtonDisabled]}>
          <GoogleMark />
          <Text style={styles.providerButtonText}>
            {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
          </Text>
        </PressableScale>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <View style={styles.field}>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage('');
              }}
              onSubmitEditing={continueWithEmail}
              placeholder="you@example.com"
              placeholderTextColor="#B7BDC8"
              returnKeyType="next"
              style={styles.input}
              value={email}
            />
          </View>
        </View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
          onPress={canContinue ? continueWithEmail : undefined}
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>
            {pending === 'email' ? 'Sending code…' : 'Continue with email'}
          </Text>
        </PressableScale>
      </FadeInView>

      <View style={styles.footer}>
        <Text style={styles.authFinePrint}>
          By continuing, you agree to Paayee’s Terms and Privacy Policy.
        </Text>
      </View>
    </AuthShell>
  );
}

function GoogleMark() {
  return (
    <Svg accessibilityLabel="Google" height={20} viewBox="0 0 24 24" width={20}>
      <Path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-4V7.4H3.2a10 10 0 0 0 0 9.2L6.5 14Z" />
      <Path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 3.2 7.4L6.5 10A5.8 5.8 0 0 1 12 6Z" />
    </Svg>
  );
}

function authMessage(error: unknown): string {
  const errorRecord = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : undefined;
  const code = typeof errorRecord?.code === 'string' ? errorRecord.code.toLowerCase() : '';
  const detail = typeof errorRecord?.error === 'string' ? errorRecord.error.toLowerCase() : '';
  const message = `${code} ${detail} ${error instanceof Error ? error.message.toLowerCase() : ''}`;

  if (message.includes('cancel')) return 'Sign-in was cancelled.';
  if (message.includes('network')) return 'Check your connection and try again.';
  if (message.includes('invalid_native_app_id') || message.includes('app identifier')) {
    return 'This app build is not allowed in Privy yet. Check its app identifier and URL scheme.';
  }
  if (
    message.includes('unsupported_login_method')
    || message.includes('invalid provider')
    || message.includes('not enabled')
  ) {
    return 'This sign-in method is not enabled in Privy yet.';
  }
  if (message.includes('too_many_requests') || message.includes('rate limit')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  return 'We could not sign you in. Please try again.';
}
