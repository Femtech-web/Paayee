create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext,
  first_name text,
  middle_name text,
  last_name text,
  phone_number text,
  date_of_birth date,
  country_of_residence text,
  residential_address text,
  paayee_handle citext unique,
  klyde_user_id text unique,
  smart_account_address text,
  setup_step text not null default 'profile_created',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_setup_step check (
    setup_step in (
      'profile_created',
      'email_verified',
      'handle_created',
      'pin_created',
      'biometrics_reviewed',
      'completed'
    )
  ),
  constraint profiles_handle_format check (
    paayee_handle is null
    or paayee_handle ~ '^[a-z0-9_]{3,24}$'
  ),
  constraint profiles_smart_account_format check (
    smart_account_address is null
    or smart_account_address ~ '^0x[a-fA-F0-9]{40}$'
  )
);

create table public.profile_security_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  pin_enabled boolean not null default false,
  biometrics_enabled boolean not null default false,
  require_unlock_after_seconds integer not null default 300,
  last_unlock_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_security_preferences_unlock_positive check (
    require_unlock_after_seconds between 30 and 3600
  )
);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  paayee_handle citext,
  wallet_address text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  preferred_asset text,
  network_id text,
  network_name text,
  chain_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficiaries_has_destination check (
    paayee_handle is not null
    or wallet_address is not null
    or bank_account_number is not null
  ),
  constraint beneficiaries_wallet_format check (
    wallet_address is null
    or wallet_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  constraint beneficiaries_preferred_asset check (
    preferred_asset is null
    or preferred_asset in ('NGN', 'USDC', 'USDT')
  ),
  constraint beneficiaries_chain_id_positive check (
    chain_id is null
    or chain_id > 0
  )
);

create index beneficiaries_profile_id_idx on public.beneficiaries (profile_id);
create index beneficiaries_profile_name_idx on public.beneficiaries (profile_id, lower(display_name));
create index profiles_paayee_handle_idx on public.profiles (paayee_handle);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profile_security_preferences_set_updated_at
before update on public.profile_security_preferences
for each row execute function public.set_updated_at();

create trigger beneficiaries_set_updated_at
before update on public.beneficiaries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profile_security_preferences enable row level security;
alter table public.beneficiaries enable row level security;

create policy "Profiles are viewable by owner"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Profiles are insertable by owner"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy "Profiles are updatable by owner"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Security preferences are viewable by owner"
on public.profile_security_preferences
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Security preferences are insertable by owner"
on public.profile_security_preferences
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Security preferences are updatable by owner"
on public.profile_security_preferences
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Beneficiaries are viewable by owner"
on public.beneficiaries
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Beneficiaries are insertable by owner"
on public.beneficiaries
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Beneficiaries are updatable by owner"
on public.beneficiaries
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Beneficiaries are deletable by owner"
on public.beneficiaries
for delete
to authenticated
using (profile_id = (select auth.uid()));
