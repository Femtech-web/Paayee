alter table public.beneficiaries
add column if not exists network_id text,
add column if not exists network_name text,
add column if not exists chain_id integer;

alter table public.beneficiaries
drop constraint if exists beneficiaries_chain_id_positive;

alter table public.beneficiaries
add constraint beneficiaries_chain_id_positive check (
  chain_id is null
  or chain_id > 0
);
