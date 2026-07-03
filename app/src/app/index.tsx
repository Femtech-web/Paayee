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
import { hasSupabaseSession } from '@/integrations/supabase';

export default function IndexScreen() {
  const [authProgress, setAuthProgress] = useState<AuthProgress | undefined>();
  const [authHref, setAuthHref] = useState<'/auth' | '/auth/login' | undefined>();
  const [lockedHref, setLockedHref] = useState<'/auth/login' | '/auth/unlock' | undefined>();
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getAuthProgress(),
      isSessionLocked(),
      getBiometricsEnabled(),
      hasPinVerifier(),
      hasSupabaseSession(),
      hasReturningUser(),
    ])
      .then(([progress, locked, biometricsEnabled, pinEnabled, hasSession, returningUser]) => {
        if (mounted) {
          setAuthProgress(progress);
          setLockedHref(
            locked ? (biometricsEnabled || pinEnabled ? '/auth/unlock' : '/auth/login') : undefined,
          );
          setAuthHref(!progress && !hasSession ? (returningUser ? '/auth/login' : '/auth') : undefined);
        }
      })
      .finally(() => {
        if (mounted) {
          setProgressLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (runtimeConfig.showAuthFlow && !progressLoaded) {
    return null;
  }

  if (runtimeConfig.showAuthFlow && lockedHref) {
    return <Redirect href={lockedHref} />;
  }

  if (runtimeConfig.showAuthFlow && authHref) {
    return <Redirect href={authHref} />;
  }

  if (runtimeConfig.showAuthFlow && authProgress && authProgress.step !== 'complete') {
    return <Redirect href={getAuthProgressHref(authProgress)} />;
  }

  return <HomeScreen />;
}
