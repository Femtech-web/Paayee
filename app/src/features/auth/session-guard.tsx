import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { runtimeConfig } from '@/config/runtime';

import {
  clearSessionLock,
  getBiometricsEnabled,
  isSessionLocked,
  lockCurrentSession,
  signOutCurrentUser,
} from './session';
import { hasPinVerifier } from './pin-security';

const publicPathPrefixes = ['/auth', '/setup', '/onboarding'];

export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!runtimeConfig.showAuthFlow) {
      return;
    }

    const subscription = AppState.addEventListener('change', async (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (nextState === 'inactive' || nextState === 'background') {
        if (!isPublicPath(pathname)) {
          await lockCurrentSession();
        }
        return;
      }

      if (nextState !== 'active' || previousState === 'active') {
        return;
      }

      if (isPublicPath(pathname)) {
        return;
      }

      if (!(await isSessionLocked())) {
        return;
      }

      const [biometricsEnabled, pinEnabled] = await Promise.all([
        getBiometricsEnabled(),
        hasPinVerifier(),
      ]);

      if (biometricsEnabled || pinEnabled) {
        router.replace('/auth/unlock' as Href);
        return;
      }

      await signOutCurrentUser();
      await clearSessionLock();
      router.replace('/auth/login' as Href);
    });

    return () => {
      subscription.remove();
    };
  }, [pathname, router]);

  return null;
}

function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}
