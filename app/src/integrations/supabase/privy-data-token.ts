import { getCurrentPrivyAccessToken } from '@/integrations/privy/session';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let cached:
  | {
      databaseToken: string;
      privyToken: string;
      validUntil: number;
    }
  | undefined;

export async function getSupabaseDataAccessToken(): Promise<string | null> {
  const privyToken = await getCurrentPrivyAccessToken();
  if (!privyToken) return null;

  if (cached && cached.privyToken === privyToken && cached.validUntil > Date.now()) {
    return cached.databaseToken;
  }

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/functions/v1/privy-session`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${privyToken}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });

  const payload = (await response.json().catch(() => ({}))) as {
    accessToken?: string;
    error?: string;
    expiresIn?: number;
  };

  if (!response.ok || !payload.accessToken) {
    throw new Error(payload.error ?? 'Paayee could not open your data session.');
  }

  cached = {
    databaseToken: payload.accessToken,
    privyToken,
    validUntil: Date.now() + Math.max(60, (payload.expiresIn ?? 600) - 60) * 1000,
  };

  return cached.databaseToken;
}
