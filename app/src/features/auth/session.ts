import * as SecureStore from 'expo-secure-store';

import { clearKlydeSession } from '@/integrations/klyde';
import { signOutFromSupabase } from '@/integrations/supabase';

import { clearAuthProgress } from './auth-progress';

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
    clearKlydeSession(),
    signOutFromSupabase(),
    clearAuthProgress(),
    clearSessionLock(),
  ]);
}
