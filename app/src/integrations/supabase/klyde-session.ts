import { runtimeConfig } from '@/config/runtime';

import { getSupabaseClient } from './client';

type KlydeHostBootstrapResponse = {
  assertion?: string;
};

export async function requestKlydeHostAppAssertion(): Promise<string> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    throw new Error('Enable real integrations to restore your money session.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<KlydeHostBootstrapResponse>(
    'klyde-host-bootstrap',
  );

  if (error) {
    throw new Error(await readFunctionErrorMessage(error));
  }

  if (!data?.assertion) {
    throw new Error('Could not restore your money session.');
  }

  return data.assertion;
}

async function readFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error);
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : undefined;

  if (context instanceof Response) {
    try {
      const payload = await context.json();
      const message = payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: unknown }).error
        : undefined;

      if (typeof message === 'string') {
        return message;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}
