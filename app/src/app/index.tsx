import { usePrivy } from '@privy-io/expo';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { runtimeConfig } from '@/config/runtime';
import {
  getAuthProgress,
  getAuthProgressHref,
  getBiometricsEnabled,
  hasReturningUser,
  isSessionLocked,
  type AuthProgress,
} from '@/features/auth';
import { hasPinVerifier } from '@/features/auth/pin-security';
import { HomeScreen } from '@/features/home/home-screen';

export default function IndexScreen() {
  if (runtimeConfig.privyConfigured) return <PrivyIndexScreen />;

  return <IndexContent sessionReady hasSession={!runtimeConfig.realIntegrationsEnabled} />;
}

function PrivyIndexScreen() {
  const { isReady, user } = usePrivy();
  return <IndexContent sessionReady={isReady} hasSession={Boolean(user)} />;
}

function IndexContent({ hasSession, sessionReady }: { hasSession: boolean; sessionReady: boolean }) {
  const [authProgress, setAuthProgress] = useState<AuthProgress | undefined>();
  const [authHref, setAuthHref] = useState<'/auth' | '/auth/login' | undefined>();
  const [lockedHref, setLockedHref] = useState<'/auth/login' | '/auth/unlock' | undefined>();
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;
    let mounted = true;

    Promise.all([
      getAuthProgress(),
      isSessionLocked(),
      getBiometricsEnabled(),
      hasPinVerifier(),
      hasReturningUser(),
    ])
      .then(([progress, locked, biometricsEnabled, pinEnabled, returningUser]) => {
        if (!mounted) return;
        setAuthProgress(progress);
        setLockedHref(
          locked && hasSession
            ? biometricsEnabled || pinEnabled
              ? '/auth/unlock'
              : '/auth/login'
            : undefined,
        );
        setAuthHref(!progress && !hasSession ? (returningUser ? '/auth/login' : '/auth') : undefined);
      })
      .finally(() => {
        if (mounted) setProgressLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [hasSession, sessionReady]);

  if (runtimeConfig.showAuthFlow && (!sessionReady || !progressLoaded)) return null;
  if (runtimeConfig.showAuthFlow && lockedHref) return <Redirect href={lockedHref} />;
  if (runtimeConfig.showAuthFlow && authHref) return <Redirect href={authHref} />;

  if (runtimeConfig.showAuthFlow && authProgress && authProgress.step !== 'complete') {
    if (!hasSession && authProgress.step !== 'verify-email') return <Redirect href="/auth/login" />;
    return <Redirect href={getAuthProgressHref(authProgress)} />;
  }

  return <HomeScreen />;
}
