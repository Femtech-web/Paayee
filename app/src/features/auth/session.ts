import * as SecureStore from 'expo-secure-store';
import type { Href } from 'expo-router';
import type { User } from '@privy-io/api-types';

import { runtimeConfig } from '@/config/runtime';
import { getPrivyUserEmail, logoutFromPrivy } from '@/integrations/privy';
import { getSupabaseClient, upsertCurrentProfile } from '@/integrations/supabase';

import { clearAuthProgress, setAuthProgress } from './auth-progress';

const RETURNING_USER_KEY = 'paayee.auth.returningUser';
const SESSION_LOCKED_KEY = 'paayee.session.locked';
const BIOMETRICS_ENABLED_KEY = 'paayee_biometrics_enabled';

export async function markReturningUser(): Promise<void> {
  await SecureStore.setItemAsync(RETURNING_USER_KEY, 'true');
}

export async function hasReturningUser(): Promise<boolean> {
  return (await SecureStore.getItemAsync(RETURNING_USER_KEY)) === 'true';
}

export async function lockCurrentSession(): Promise<void> {
  await SecureStore.setItemAsync(SESSION_LOCKED_KEY, 'true');
}

export async function clearSessionLock(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_LOCKED_KEY);
}

export async function isSessionLocked(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SESSION_LOCKED_KEY)) === 'true';
}

export async function getBiometricsEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY)) === 'true';
}

export async function signOutCurrentUser(): Promise<void> {
  await Promise.allSettled([
    logoutFromPrivy(),
    clearAuthProgress(),
    clearSessionLock(),
  ]);
}

export async function completePrivySignIn(user: User): Promise<Href> {
  let setupComplete = false;

  if (runtimeConfig.realIntegrationsEnabled) {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('setup_step')
      .eq('privy_user_id', user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    setupComplete = data?.setup_step === 'completed';

    await upsertCurrentProfile({
      email: getPrivyUserEmail(user),
      privyUserId: user.id,
      setupStep: data ? undefined : 'profile_created',
    });
  }

  await Promise.all([markReturningUser(), clearSessionLock()]);

  if (setupComplete) {
    await clearAuthProgress();
    return '/?authDone=1' as Href;
  }

  await setAuthProgress({ email: getPrivyUserEmail(user), step: 'handle' });
  return '/setup/handle' as Href;
}
