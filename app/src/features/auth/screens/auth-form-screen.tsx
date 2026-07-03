import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { FeedbackToast } from '@/components/feedback-toast';
import { runtimeConfig } from '@/config/runtime';
import { startKlydeEmailVerification } from '@/integrations/klyde';
import { signInWithEmail, signUpWithEmail, upsertCurrentProfile } from '@/integrations/supabase';

import {
  clearAuthProgress,
  getAuthProgress,
  getAuthProgressHref,
  setAuthProgress,
} from '../auth-progress';
import { formatAuthError, isAlreadyRegisteredError } from '../auth-errors';
import { authStyles as styles } from '../auth-screen.styles';
import { clearSessionLock, markReturningUser } from '../session';
import { AuthShell } from './auth-shell';

type AuthMode = 'signup' | 'login';

export function AuthFormScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { entry, fresh } = useLocalSearchParams<{ entry?: string; fresh?: string }>();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const isSignup = mode === 'signup';
  const showBack = entry === 'welcome';
  const normalizedEmail = email.trim().toLowerCase();
  const canContinue =
    normalizedEmail.includes('@') &&
    password.length >= 8 &&
    (!isSignup || (firstName.trim().length > 1 && lastName.trim().length > 1));

  useEffect(() => {
    if (!isSignup) {
      return;
    }

    let mounted = true;

    async function resumeSignup() {
      if (fresh === '1') {
        await clearAuthProgress();
        return;
      }

      const progress = await getAuthProgress();

      if (mounted && progress && progress.step !== 'complete') {
        router.replace(getAuthProgressHref(progress));
      }
    }

    resumeSignup();

    return () => {
      mounted = false;
    };
  }, [fresh, isSignup, router]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const continueFlow = async () => {
    if (!canContinue || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (isSignup) {
        await createOrResumeSignupSession({
          email: normalizedEmail,
          firstName,
          lastName,
          password,
        });

        const challenge = runtimeConfig.realIntegrationsEnabled
          ? await startKlydeEmailVerification({ email: normalizedEmail })
          : undefined;
        const progress = await setAuthProgress({
          challengeId: challenge?.challengeId,
          email: normalizedEmail,
          step: 'verify-email',
        });

        router.replace(getAuthProgressHref(progress));
      } else {
        await signInWithEmail(normalizedEmail, password);
        await Promise.all([markReturningUser(), clearSessionLock()]);
        router.replace('/?authDone=1' as Href);
      }
    } catch (error) {
      setErrorMessage(formatAuthError(error, isSignup ? 'signup' : 'login'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell showBack={showBack} showBrand={false}>
      <FadeInView delay={50} style={styles.copy}>
        <Text style={styles.detailTitle}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.subtitle}>
          {isSignup
            ? 'Tell us your name and sign-in details. You can complete verification when you need higher limits.'
            : 'Log in securely to continue moving money with Paayee.'}
        </Text>
      </FadeInView>
      <FeedbackToast message={errorMessage} tone="error" />

      <FadeInView delay={90} style={[styles.form, styles.authPanel]}>
        {isSignup ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>First name</Text>
              <View style={styles.field}>
                <TextInput
                  autoCapitalize="words"
                  autoComplete="given-name"
                  onChangeText={(value) => {
                    setFirstName(value);
                    setErrorMessage('');
                  }}
                  placeholder="Enter your first name"
                  placeholderTextColor="#B7BDC8"
                  style={styles.input}
                  value={firstName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Last name</Text>
              <View style={styles.field}>
                <TextInput
                  autoCapitalize="words"
                  autoComplete="family-name"
                  onChangeText={(value) => {
                    setLastName(value);
                    setErrorMessage('');
                  }}
                  placeholder="Enter your last name"
                  placeholderTextColor="#B7BDC8"
                  style={styles.input}
                  value={lastName}
                />
              </View>
            </View>
          </>
        ) : null}

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
              placeholder="Enter your email address"
              placeholderTextColor="#B7BDC8"
              style={styles.input}
              value={email}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.field}>
            <TextInput
              autoCapitalize="none"
              onChangeText={(value) => {
                setPassword(value);
                setErrorMessage('');
              }}
              placeholder="Enter your password"
              placeholderTextColor="#B7BDC8"
              secureTextEntry={!visible}
              style={styles.input}
              value={password}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              onPress={() => setVisible((next) => !next)}>
              <Feather name={visible ? 'eye-off' : 'eye'} size={19} color="#4C5361" />
            </PressableScale>
          </View>
          {isSignup ? (
            <Text style={styles.hint}>
              Use at least 8 characters. A stronger password keeps your account harder to access.
            </Text>
          ) : null}
        </View>
      </FadeInView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={isSignup ? 'Continue signup' : 'Log in'}
          onPress={canContinue && !submitting ? continueFlow : undefined}
          style={[styles.primaryButton, (!canContinue || submitting) && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Please wait...' : isSignup ? 'Continue' : 'Log in'}
          </Text>
        </PressableScale>
        <Text style={styles.inlineText}>
          {isSignup ? 'Already have an account? ' : 'New to Paayee? '}
          <Text
            onPress={() => router.replace(isSignup ? '/auth/login' : ('/auth/signup' as Href))}
            style={styles.inlineAction}>
            {isSignup ? 'Log in' : 'Create account'}
          </Text>
        </Text>
      </View>
    </AuthShell>
  );
}

async function createOrResumeSignupSession({
  email,
  firstName,
  lastName,
  password,
}: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  try {
    await signUpWithEmail(email, password, {
      firstName,
      lastName,
    });
    return;
  } catch (error) {
    if (!isAlreadyRegisteredError(error)) {
      throw error;
    }
  }

  await signInWithEmail(email, password);
  await upsertCurrentProfile({
    email,
    firstName,
    lastName,
    setupStep: 'profile_created',
  });
}
