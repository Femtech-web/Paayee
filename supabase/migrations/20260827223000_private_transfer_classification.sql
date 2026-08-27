-- ERC-7984 wrap/mint events use the zero address as sender and were briefly
-- indexed as peer-to-peer private receives. Remove those duplicate rows and
-- attach known Paayee sender identities to genuine private transfers.

alter table public.paayee_private_transfers
  add column if not exists sender_profile_id uuid
  references public.profiles (id) on delete set null;

delete from public.paayee_private_transfers
where lower(from_address) = '0x0000000000000000000000000000000000000000'
   or exists (
     select 1
     from public.paayee_operations
     where paayee_operations.chain_id = paayee_private_transfers.chain_id
       and lower(paayee_operations.transaction_hash) = lower(paayee_private_transfers.transaction_hash)
       and paayee_operations.kind = 'shield'
   );

update public.paayee_private_transfers as private_transfer
set sender_profile_id = sender.id
from public.profiles as sender
where private_transfer.sender_profile_id is null
  and sender.smart_account_address is not null
  and lower(sender.smart_account_address) = lower(private_transfer.from_address);

create index if not exists paayee_private_transfers_sender_profile_idx
  on public.paayee_private_transfers (sender_profile_id)
  where sender_profile_id is not null;
