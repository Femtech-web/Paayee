-- Paayee gas sponsorship and fee-accounting ledger. Privy pays the network
-- gas, while these rows let Paayee audit sponsored calls and the stablecoin
-- fee shown to the user.

create table public.paayee_fee_quotes (
  id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chain_id integer not null,
  kind text not null,
  token_symbol text not null,
  amount_minor_units numeric(78, 0) not null,
  fee_minor_units numeric(78, 0) not null,
  display_currency text not null,
  display_amount numeric not null,
  gas_units bigint not null,
  max_fee_per_gas_wei numeric(78, 0) not null,
  markup_bps integer not null,
  treasury_address text,
  status text not null default 'quoted',
  operation_transaction_hash text,
  fee_transaction_hash text,
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paayee_fee_quotes_kind check (kind in ('shield', 'unshield', 'private-send')),
  constraint paayee_fee_quotes_symbol check (token_symbol in ('USDC', 'USDT')),
  constraint paayee_fee_quotes_status check (status in ('quoted', 'submitted', 'collected', 'failed', 'expired')),
  constraint paayee_fee_quotes_amounts_positive check (amount_minor_units > 0 and fee_minor_units > 0),
  constraint paayee_fee_quotes_treasury_format check (
    treasury_address is null or treasury_address ~ '^0x[a-fA-F0-9]{40}$'
  )
);

create table public.paayee_sponsored_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chain_id integer not null,
  wallet_address text not null,
  destination_address text not null,
  function_selector text not null,
  idempotency_key text not null unique,
  transaction_hash text not null,
  privy_transaction_id text,
  status text not null default 'submitted',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paayee_sponsored_transactions_status check (status in ('submitted', 'confirmed', 'failed')),
  constraint paayee_sponsored_transactions_addresses check (
    wallet_address ~ '^0x[a-fA-F0-9]{40}$'
    and destination_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  constraint paayee_sponsored_transactions_selector check (function_selector ~ '^0x[a-fA-F0-9]{8}$'),
  constraint paayee_sponsored_transactions_hash check (transaction_hash ~ '^0x[a-fA-F0-9]{64}$')
);

create index paayee_fee_quotes_profile_created_idx on public.paayee_fee_quotes (profile_id, created_at desc);
create index paayee_fee_quotes_status_idx on public.paayee_fee_quotes (status, expires_at);
create index paayee_sponsored_transactions_profile_created_idx
  on public.paayee_sponsored_transactions (profile_id, created_at desc);
create index paayee_sponsored_transactions_status_idx
  on public.paayee_sponsored_transactions (status, created_at);

create trigger paayee_fee_quotes_set_updated_at
before update on public.paayee_fee_quotes
for each row execute function public.set_updated_at();

create trigger paayee_sponsored_transactions_set_updated_at
before update on public.paayee_sponsored_transactions
for each row execute function public.set_updated_at();

alter table public.paayee_fee_quotes enable row level security;
alter table public.paayee_sponsored_transactions enable row level security;

create policy "Fee quotes are viewable by Privy owner"
on public.paayee_fee_quotes for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Sponsored transactions are viewable by Privy owner"
on public.paayee_sponsored_transactions for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));
