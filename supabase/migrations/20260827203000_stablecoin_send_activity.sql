-- Add first-class public sends and chain-indexed confidential receives to
-- Paayee's user-scoped activity ledger. Confidential amounts remain encrypted.

alter table public.paayee_operations
  add column if not exists destination_address text;

alter table public.paayee_operations
  drop constraint if exists paayee_operations_kind;

alter table public.paayee_operations
  add constraint paayee_operations_kind
  check (kind in ('shield', 'unshield', 'public_send'));

alter table public.paayee_operations
  drop constraint if exists paayee_operations_destination;

alter table public.paayee_operations
  add constraint paayee_operations_destination
  check (
    (kind in ('shield', 'unshield') and destination_address is null)
    or
    (kind = 'public_send' and destination_address ~ '^0x[a-fA-F0-9]{40}$')
  );

create table if not exists public.paayee_private_transfers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chain_id integer not null,
  token_symbol text not null,
  confidential_token_address text not null,
  from_address text not null,
  to_address text not null,
  encrypted_amount_handle text not null,
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
  constraint paayee_private_transfers_symbol check (token_symbol in ('USDC', 'USDT')),
  constraint paayee_private_transfers_status check (status in ('detected', 'confirming', 'confirmed', 'reorged')),
  constraint paayee_private_transfers_handle check (encrypted_amount_handle ~ '^0x[a-fA-F0-9]{64}$'),
  constraint paayee_private_transfers_address_format check (
    confidential_token_address ~ '^0x[a-fA-F0-9]{40}$'
    and from_address ~ '^0x[a-fA-F0-9]{40}$'
    and to_address ~ '^0x[a-fA-F0-9]{40}$'
  )
);

alter table public.paayee_receipts
  add column if not exists private_transfer_id uuid
  references public.paayee_private_transfers (id) on delete cascade;

alter table public.paayee_receipts
  add column if not exists encrypted_amount_handle text;

alter table public.paayee_receipts
  drop constraint if exists paayee_receipts_parent;

alter table public.paayee_receipts
  add constraint paayee_receipts_parent
  check (num_nonnulls(deposit_id, operation_id, private_transfer_id) = 1);

alter table public.paayee_receipts
  drop constraint if exists paayee_receipts_type;

alter table public.paayee_receipts
  add constraint paayee_receipts_type
  check (receipt_type in ('deposit', 'shield', 'unshield', 'send', 'private_receive'));

create index if not exists paayee_operations_destination_created_idx
  on public.paayee_operations (lower(destination_address), created_at desc)
  where destination_address is not null;

create unique index if not exists paayee_receipts_private_transfer_key
  on public.paayee_receipts (private_transfer_id);

create index if not exists paayee_private_transfers_profile_created_idx
  on public.paayee_private_transfers (profile_id, created_at desc);

create trigger paayee_private_transfers_set_updated_at
before update on public.paayee_private_transfers
for each row execute function public.set_updated_at();

alter table public.paayee_private_transfers enable row level security;

create policy "Private transfers are viewable by Privy owner"
on public.paayee_private_transfers for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));
