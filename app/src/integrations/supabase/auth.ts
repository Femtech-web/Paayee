import { runtimeConfig } from '@/config/runtime';
import { getCurrentPrivyUser, getPrivyUserEmail } from '@/integrations/privy/session';

import { getSupabaseClient } from './client';

type SetupStep =
  | 'profile_created'
  | 'email_verified'
  | 'handle_created'
  | 'pin_created'
  | 'biometrics_reviewed'
  | 'completed';

export async function upsertCurrentProfile(input: {
  countryOfResidence?: string;
  dateOfBirth?: string;
  email?: string;
  firstName?: string;
  handle?: string;
  lastName?: string;
  phoneNumber?: string;
  residentialAddress?: string;
  privyUserId?: string;
  setupStep?: SetupStep;
  smartAccountAddress?: string;
}) {
  if (!runtimeConfig.realIntegrationsEnabled) return;

  const user = getCurrentPrivyUser();
  const privyUserId = input.privyUserId ?? user?.id;
  if (!privyUserId) throw new Error('Sign in again to continue.');

  const { error } = await getSupabaseClient().from('profiles').upsert(
    {
      country_of_residence: input.countryOfResidence,
      date_of_birth: input.dateOfBirth,
      email: input.email ?? getPrivyUserEmail(user),
      first_name: input.firstName,
      last_name: input.lastName,
      onboarding_completed_at: input.setupStep === 'completed' ? new Date().toISOString() : undefined,
      paayee_handle: input.handle,
      phone_number: input.phoneNumber,
      privy_user_id: privyUserId,
      residential_address: input.residentialAddress,
      setup_step: input.setupStep,
      smart_account_address: input.smartAccountAddress,
    },
    { onConflict: 'privy_user_id' },
  );

  if (error) throw new Error(error.message);
}

export async function setPinEnabled() {
  await updateSecurityPreferences({ pin_enabled: true });
}

export async function setBiometricsEnabled(enabled: boolean) {
  await updateSecurityPreferences({ biometrics_enabled: enabled });
}

async function updateSecurityPreferences(values: {
  biometrics_enabled?: boolean;
  pin_enabled?: boolean;
}) {
  if (!runtimeConfig.realIntegrationsEnabled) return;

  const profileId = await getCurrentProfileId();
  const { error } = await getSupabaseClient().from('profile_security_preferences').upsert(
    { ...values, profile_id: profileId },
    { onConflict: 'profile_id' },
  );

  if (error) throw new Error(error.message);
}

export async function getCurrentProfileId(): Promise<string> {
  const privyUserId = getCurrentPrivyUser()?.id;
  if (!privyUserId) throw new Error('Sign in again to continue.');

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id')
    .eq('privy_user_id', privyUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.id) return data.id as string;

  await upsertCurrentProfile({ privyUserId, setupStep: 'profile_created' });
  return getCurrentProfileId();
}
