create or replace function public.lookup_paayee_handle(input_handle text)
returns table (
  paayee_handle citext,
  display_name text,
  smart_account_address text
)
language sql
security definer
set search_path = ''
as $$
  select
    profiles.paayee_handle,
    nullif(
      trim(
        concat_ws(
          ' ',
          profiles.first_name,
          profiles.middle_name,
          profiles.last_name
        )
      ),
      ''
    ) as display_name,
    profiles.smart_account_address
  from public.profiles
  where profiles.paayee_handle = lower(regexp_replace(trim(input_handle), '^@+', ''))
    and profiles.smart_account_address is not null
  limit 1;
$$;

revoke all on function public.lookup_paayee_handle(text) from public;
grant execute on function public.lookup_paayee_handle(text) to authenticated;
