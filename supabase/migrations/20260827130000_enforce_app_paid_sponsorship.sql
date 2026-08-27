-- Make sponsored gas free to Paayee users on every network, and retain exact
-- simulation plus post-confirmation accounting for Paayee's internal controls.

alter table public.paayee_fee_quotes
  drop constraint if exists paayee_fee_quotes_amounts_positive;

alter table public.paayee_fee_quotes
  add constraint paayee_fee_quotes_amounts_positive check (
    amount_minor_units > 0 and fee_minor_units >= 0
  );

alter table public.paayee_fee_quotes
  drop constraint if exists paayee_fee_quotes_status,
  drop constraint if exists paayee_fee_quotes_status_check;

alter table public.paayee_fee_quotes
  add constraint paayee_fee_quotes_status_check check (
    status in ('quoted', 'submitted', 'collected', 'waived', 'failed', 'expired')
  );

alter table public.paayee_sponsored_transactions
  alter column transaction_hash drop not null,
  add column if not exists wallet_id text,
  add column if not exists user_operation_hash text,
  add column if not exists estimated_gas_units bigint,
  add column if not exists estimated_max_fee_per_gas_wei numeric(78, 0),
  add column if not exists estimated_network_cost_wei numeric(78, 0),
  add column if not exists estimated_network_cost_usd numeric,
  add column if not exists actual_gas_used bigint,
  add column if not exists effective_gas_price_wei numeric(78, 0),
  add column if not exists actual_network_cost_wei numeric(78, 0);

alter table public.paayee_sponsored_transactions
  drop constraint if exists paayee_sponsored_transactions_hash;

alter table public.paayee_sponsored_transactions
  add constraint paayee_sponsored_transactions_hash check (
    transaction_hash is null or transaction_hash ~ '^0x[a-fA-F0-9]{64}$'
  ),
  add constraint paayee_sponsored_transactions_user_operation_hash check (
    user_operation_hash is null or user_operation_hash ~ '^0x[a-fA-F0-9]{64}$'
  );

create table if not exists public.paayee_privy_gas_spend_windows (
  id uuid primary key default gen_random_uuid(),
  sponsored_transaction_id uuid not null unique
    references public.paayee_sponsored_transactions (id) on delete cascade,
  wallet_id text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  spend_usd numeric not null check (spend_usd >= 0),
  currency text not null default 'usd' check (currency = 'usd'),
  created_at timestamptz not null default now()
);

alter table public.paayee_privy_gas_spend_windows enable row level security;

create policy "Privy gas spend is viewable by transaction owner"
on public.paayee_privy_gas_spend_windows for select to authenticated
using (exists (
  select 1
  from public.paayee_sponsored_transactions sponsored
  join public.profiles on profiles.id = sponsored.profile_id
  where sponsored.id = sponsored_transaction_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));
