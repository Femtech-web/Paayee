-- Minimal chain activity ledger for Paayee. The chain remains the source of
-- truth; these rows make deposits, confirmations, receipts, and user-initiated
-- privacy operations queryable by the mobile app.

create table public.paayee_indexer_checkpoints (
  chain_id integer not null,
  source text not null,
  last_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, source),
  constraint paayee_indexer_checkpoints_chain_positive check (chain_id > 0),
  constraint paayee_indexer_checkpoints_block_nonnegative check (last_block >= 0)
);

create table public.paayee_deposits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chain_id integer not null,
  token_symbol text not null,
  token_address text not null,
  from_address text not null,
  to_address text not null,
  amount_minor_units numeric(78, 0) not null,
  token_decimals smallint not null default 6,
  transaction_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  block_timestamp timestamptz,
  confirmations integer not null default 0,
  status text not null default 'detected',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, transaction_hash, log_index),
  constraint paayee_deposits_symbol check (token_symbol in ('USDC', 'USDT')),
  constraint paayee_deposits_status check (status in ('detected', 'confirming', 'confirmed', 'reorged')),
  constraint paayee_deposits_amount_positive check (amount_minor_units > 0),
  constraint paayee_deposits_address_format check (
    token_address ~ '^0x[a-fA-F0-9]{40}$'
    and from_address ~ '^0x[a-fA-F0-9]{40}$'
    and to_address ~ '^0x[a-fA-F0-9]{40}$'
  )
);

create table public.paayee_operations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chain_id integer not null,
  kind text not null,
  token_symbol text not null,
  public_token_address text not null,
  confidential_token_address text not null,
  amount_minor_units numeric(78, 0) not null,
  transaction_hash text not null,
  status text not null default 'submitted',
  metadata jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, transaction_hash, kind),
  constraint paayee_operations_kind check (kind in ('shield', 'unshield')),
  constraint paayee_operations_symbol check (token_symbol in ('USDC', 'USDT')),
  constraint paayee_operations_status check (status in ('submitted', 'confirmed', 'failed')),
  constraint paayee_operations_amount_positive check (amount_minor_units > 0)
);

create table public.paayee_receipts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  deposit_id uuid references public.paayee_deposits (id) on delete cascade,
  operation_id uuid references public.paayee_operations (id) on delete cascade,
  receipt_type text not null,
  title text not null,
  detail text not null,
  token_symbol text,
  amount_minor_units numeric(78, 0),
  token_decimals smallint,
  transaction_hash text,
  status text not null,
  created_at timestamptz not null default now(),
  constraint paayee_receipts_parent check (
    (deposit_id is not null and operation_id is null)
    or (deposit_id is null and operation_id is not null)
  ),
  constraint paayee_receipts_type check (receipt_type in ('deposit', 'shield', 'unshield'))
);

create unique index paayee_receipts_deposit_key on public.paayee_receipts (deposit_id);
create unique index paayee_receipts_operation_key on public.paayee_receipts (operation_id);

create index paayee_deposits_profile_created_idx on public.paayee_deposits (profile_id, created_at desc);
create index paayee_deposits_to_status_idx on public.paayee_deposits (lower(to_address), status);
create index paayee_operations_profile_created_idx on public.paayee_operations (profile_id, created_at desc);
create index paayee_receipts_profile_created_idx on public.paayee_receipts (profile_id, created_at desc);

create trigger paayee_deposits_set_updated_at
before update on public.paayee_deposits
for each row execute function public.set_updated_at();

create trigger paayee_operations_set_updated_at
before update on public.paayee_operations
for each row execute function public.set_updated_at();

alter table public.paayee_indexer_checkpoints enable row level security;
alter table public.paayee_deposits enable row level security;
alter table public.paayee_operations enable row level security;
alter table public.paayee_receipts enable row level security;

create policy "Deposits are viewable by Privy owner"
on public.paayee_deposits for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Operations are viewable by Privy owner"
on public.paayee_operations for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Operations are insertable by Privy owner"
on public.paayee_operations for insert to authenticated
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Receipts are viewable by Privy owner"
on public.paayee_receipts for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));
