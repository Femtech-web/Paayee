import type { KlydeAuthResult } from './client';
import { getKlydeWallet } from './client';
import { upsertCurrentProfile } from '@/integrations/supabase';

export async function linkKlydeAccountToCurrentProfile({
  authResult,
  email,
}: {
  authResult: KlydeAuthResult;
  email: string;
}) {
  const wallet = authResult.wallet ?? (await getKlydeWallet());

  await upsertCurrentProfile({
    email,
    klydeUserId: authResult.user.id,
    setupStep: 'email_verified',
    smartAccountAddress: wallet.address,
  });

  return {
    user: authResult.user,
    wallet,
  };
}
