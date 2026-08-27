alter table public.profiles
  add column if not exists privy_user_id text;

create unique index if not exists profiles_privy_user_id_key
  on public.profiles (privy_user_id)
  where privy_user_id is not null;

comment on column public.profiles.privy_user_id is
  'Privy user identifier backing the Paayee embedded wallet.';
