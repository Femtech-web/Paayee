import { getSupabaseClient } from './client';
import { runtimeConfig } from '@/config/runtime';

const mockAuthData = {
  session: null,
  user: null,
};

export async function signUpWithEmail(
  email: string,
  password: string,
  profile?: {
    firstName?: string;
    lastName?: string;
  },
) {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return mockAuthData;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    options: {
      data: {
        first_name: profile?.firstName?.trim(),
        last_name: profile?.lastName?.trim(),
      },
    },
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.user && data.session) {
    await upsertCurrentProfile({
      email: data.user.email ?? email.trim().toLowerCase(),
      firstName: profile?.firstName,
      id: data.user.id,
      lastName: profile?.lastName,
      setupStep: 'profile_created',
    });
  }

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return mockAuthData;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signOutFromSupabase() {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function hasSupabaseSession() {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return true;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return false;
  }

  return Boolean(data.session);
}

export async function upsertCurrentProfile(input: {
  countryOfResidence?: string;
  dateOfBirth?: string;
  email?: string;
  firstName?: string;
  handle?: string;
  id?: string;
  klydeUserId?: string;
  lastName?: string;
  phoneNumber?: string;
  residentialAddress?: string;
  setupStep?:
    | 'profile_created'
    | 'email_verified'
    | 'handle_created'
    | 'pin_created'
    | 'biometrics_reviewed'
    | 'completed';
  smartAccountAddress?: string;
}) {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return;
  }

  const supabase = getSupabaseClient();
  const userId = input.id ?? (await getCurrentUserId());
  const { error } = await supabase.from('profiles').upsert(
    {
      country_of_residence: input.countryOfResidence,
      date_of_birth: input.dateOfBirth,
      email: input.email,
      first_name: input.firstName,
      id: userId,
      klyde_user_id: input.klydeUserId,
      last_name: input.lastName,
      onboarding_completed_at: input.setupStep === 'completed' ? new Date().toISOString() : undefined,
      paayee_handle: input.handle,
      phone_number: input.phoneNumber,
      residential_address: input.residentialAddress,
      setup_step: input.setupStep,
      smart_account_address: input.smartAccountAddress,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function requestEmailChange(email: string) {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    email: email.trim().toLowerCase(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function setPinEnabled() {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return;
  }

  const supabase = getSupabaseClient();
  const profileId = await getCurrentUserId();
  const { error } = await supabase.from('profile_security_preferences').upsert(
    {
      pin_enabled: true,
      profile_id: profileId,
    },
    { onConflict: 'profile_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function setBiometricsEnabled(enabled: boolean) {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return;
  }

  const supabase = getSupabaseClient();
  const profileId = await getCurrentUserId();
  const { error } = await supabase.from('profile_security_preferences').upsert(
    {
      biometrics_enabled: enabled,
      profile_id: profileId,
    },
    { onConflict: 'profile_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function getCurrentUserId() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Log in again to continue setup.');
  }

  return data.user.id;
}
