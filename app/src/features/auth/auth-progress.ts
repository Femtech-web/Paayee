import * as SecureStore from 'expo-secure-store';
import type { Href } from 'expo-router';

const AUTH_PROGRESS_KEY = 'paayee.auth.progress';

export type AuthProgressStep =
  | 'verify-email'
  | 'setting-up'
  | 'handle'
  | 'pin'
  | 'biometrics'
  | 'complete';

export type AuthProgress = {
  challengeId?: string;
  email?: string;
  step: AuthProgressStep;
  updatedAt: string;
};

export async function getAuthProgress(): Promise<AuthProgress | undefined> {
  const rawProgress = await SecureStore.getItemAsync(AUTH_PROGRESS_KEY);

  if (!rawProgress) {
    return undefined;
  }

  try {
    return JSON.parse(rawProgress) as AuthProgress;
  } catch {
    await clearAuthProgress();
    return undefined;
  }
}

export async function setAuthProgress(input: {
  challengeId?: string;
  email?: string;
  step: AuthProgressStep;
}): Promise<AuthProgress> {
  const nextProgress: AuthProgress = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(AUTH_PROGRESS_KEY, JSON.stringify(nextProgress));

  return nextProgress;
}

export async function clearAuthProgress(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_PROGRESS_KEY);
}

export function getAuthProgressHref(progress: AuthProgress): Href {
  switch (progress.step) {
    case 'verify-email': {
      const query = [
        progress.email ? `email=${encodeURIComponent(progress.email)}` : '',
        progress.challengeId ? `challengeId=${encodeURIComponent(progress.challengeId)}` : '',
      ]
        .filter(Boolean)
        .join('&');

      return `/auth/verify${query ? `?${query}` : ''}` as Href;
    }
    case 'setting-up':
      return '/setup/handle' as Href;
    case 'handle':
      return '/setup/handle' as Href;
    case 'pin':
      return '/setup/pin' as Href;
    case 'biometrics':
      return '/setup/biometrics' as Href;
    case 'complete':
      return '/?authDone=1' as Href;
  }
}
