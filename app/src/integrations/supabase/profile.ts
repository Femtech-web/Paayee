import { runtimeConfig } from '@/config/runtime';

import { getSupabaseClient } from './client';

export type PaayeeProfile = {
  countryOfResidence?: string;
  dateOfBirth?: string;
  email?: string;
  firstName?: string;
  handle?: string;
  id: string;
  klydeUserId?: string;
  lastName?: string;
  middleName?: string;
  phoneNumber?: string;
  residentialAddress?: string;
  setupStep?: string;
  smartAccountAddress?: string;
};

export type PaayeeHandleLookup = {
  displayName: string;
  handle: string;
  smartAccountAddress: string;
};

type PaayeeHandleLookupRow = {
  display_name?: string | null;
  paayee_handle?: string | null;
  smart_account_address?: string | null;
};

type PaayeeProfileRow = {
  country_of_residence?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  first_name?: string | null;
  id: string;
  klyde_user_id?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  paayee_handle?: string | null;
  phone_number?: string | null;
  residential_address?: string | null;
  setup_step?: string | null;
  smart_account_address?: string | null;
};

export type PaayeeBeneficiary = {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  chainId?: number;
  displayName: string;
  handle?: string;
  id: string;
  networkId?: string;
  networkName?: string;
  preferredAsset?: 'NGN' | 'USDC' | 'USDT';
  walletAddress?: string;
};

export type SavePaayeeBeneficiaryInput = {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  chainId?: number;
  displayName: string;
  handle?: string;
  networkId?: string;
  networkName?: string;
  preferredAsset?: 'NGN' | 'USDC' | 'USDT';
  walletAddress?: string;
};

type PaayeeBeneficiaryRow = {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  chain_id?: number | null;
  display_name: string;
  id: string;
  network_id?: string | null;
  network_name?: string | null;
  paayee_handle?: string | null;
  preferred_asset?: 'NGN' | 'USDC' | 'USDT' | null;
  wallet_address?: string | null;
};

export async function getCurrentProfile(): Promise<PaayeeProfile | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    return undefined;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id,email,first_name,middle_name,last_name,phone_number,date_of_birth,country_of_residence,residential_address,paayee_handle,klyde_user_id,smart_account_address,setup_step',
    )
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as PaayeeProfileRow | null;

  if (!row) {
    return {
      email: authData.user.email ?? undefined,
      id: authData.user.id,
    };
  }

  return {
    countryOfResidence: row.country_of_residence ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    email: row.email ?? authData.user.email ?? undefined,
    firstName: row.first_name ?? undefined,
    handle: row.paayee_handle ?? undefined,
    id: row.id,
    klydeUserId: row.klyde_user_id ?? undefined,
    lastName: row.last_name ?? undefined,
    middleName: row.middle_name ?? undefined,
    phoneNumber: row.phone_number ?? undefined,
    residentialAddress: row.residential_address ?? undefined,
    setupStep: row.setup_step ?? undefined,
    smartAccountAddress: row.smart_account_address ?? undefined,
  };
}

export async function listCurrentBeneficiaries(): Promise<PaayeeBeneficiary[]> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('beneficiaries')
    .select(
      'id,display_name,paayee_handle,wallet_address,bank_name,bank_account_number,bank_account_name,preferred_asset,network_id,network_name,chain_id',
    )
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PaayeeBeneficiaryRow[]).map((row) => ({
    accountName: row.bank_account_name ?? undefined,
    accountNumber: row.bank_account_number ?? undefined,
    bankName: row.bank_name ?? undefined,
    chainId: row.chain_id ?? undefined,
    displayName: row.display_name,
    handle: row.paayee_handle ?? undefined,
    id: row.id,
    networkId: row.network_id ?? undefined,
    networkName: row.network_name ?? undefined,
    preferredAsset: row.preferred_asset ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
  }));
}

export async function saveCurrentBeneficiary(input: SavePaayeeBeneficiaryInput): Promise<void> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return;
  }

  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error('Please log in again to save this recipient.');
  }

  const displayName = input.displayName.trim();

  if (!displayName) {
    throw new Error('Enter a display name.');
  }

  const { error } = await supabase.from('beneficiaries').insert({
    bank_account_name: cleanOptional(input.accountName),
    bank_account_number: cleanOptional(input.accountNumber),
    bank_name: cleanOptional(input.bankName),
    chain_id: input.chainId ?? null,
    display_name: displayName,
    network_id: cleanOptional(input.networkId),
    network_name: cleanOptional(input.networkName),
    paayee_handle: input.handle ? input.handle.trim().replace(/^@+/, '').toLowerCase() : null,
    preferred_asset: input.preferredAsset ?? null,
    profile_id: authData.user.id,
    wallet_address: cleanOptional(input.walletAddress),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function lookupPaayeeHandle(handle: string): Promise<PaayeeHandleLookup | undefined> {
  if (!runtimeConfig.realIntegrationsEnabled) {
    return undefined;
  }

  const normalizedHandle = handle.trim().replace(/^@+/, '').toLowerCase();

  if (!normalizedHandle) {
    return undefined;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc('lookup_paayee_handle', { input_handle: normalizedHandle })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as PaayeeHandleLookupRow | null;

  if (!row?.paayee_handle || !row.smart_account_address) {
    return undefined;
  }

  return {
    displayName: row.display_name || `@${row.paayee_handle}`,
    handle: row.paayee_handle,
    smartAccountAddress: row.smart_account_address,
  };
}

function cleanOptional(value?: string): string | null {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}
