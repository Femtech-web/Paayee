export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Check your connection and try again.';
  }

  if (normalized.includes('session') || normalized.includes('sign in')) {
    return 'Your session expired. Sign in again to continue.';
  }

  return message || 'Something went wrong. Please try again.';
}
