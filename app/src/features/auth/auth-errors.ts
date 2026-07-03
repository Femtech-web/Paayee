export function formatAuthError(error: unknown, context: 'login' | 'signup' | 'verify' = 'signup') {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (isAlreadyRegisteredError(error)) {
    return 'That email already has an account. Enter the same password to continue setup, or log in instead.';
  }

  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return context === 'signup'
      ? 'That email already has an account. Check the password or log in instead.'
      : 'The email or password is not correct.';
  }

  if (normalized.includes('auth session missing')) {
    return 'Your session expired. Log in again to continue.';
  }

  if (normalized.includes('password')) {
    return 'Use a stronger password with at least 8 characters.';
  }

  if (normalized.includes('network') || normalized.includes('fetch failed')) {
    return 'We could not connect right now. Check your connection and try again.';
  }

  if (normalized.includes('verification code') || normalized.includes('code is invalid')) {
    return 'That code is not correct. Check the email and try again.';
  }

  if (normalized.includes('expired')) {
    return 'That code has expired. Request a new code to continue.';
  }

  return message || 'Something went wrong. Please try again.';
}

export function isAlreadyRegisteredError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('already registered');
}
