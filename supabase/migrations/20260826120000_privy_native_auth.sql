-- Privy is Paayee's sole identity provider. Supabase remains the data store and
-- authorizes rows from the verified Privy JWT `sub` claim.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

-- PostgREST upserts need a non-partial unique index for `on_conflict` inference.
-- PostgreSQL unique indexes already permit multiple null values.
drop index if exists public.profiles_privy_user_id_key;
create unique index profiles_privy_user_id_key on public.profiles (privy_user_id);

drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Profiles are insertable by owner" on public.profiles;
drop policy if exists "Profiles are updatable by owner" on public.profiles;
drop policy if exists "Security preferences are viewable by owner" on public.profile_security_preferences;
drop policy if exists "Security preferences are insertable by owner" on public.profile_security_preferences;
drop policy if exists "Security preferences are updatable by owner" on public.profile_security_preferences;
drop policy if exists "Beneficiaries are viewable by owner" on public.beneficiaries;
drop policy if exists "Beneficiaries are insertable by owner" on public.beneficiaries;
drop policy if exists "Beneficiaries are updatable by owner" on public.beneficiaries;
drop policy if exists "Beneficiaries are deletable by owner" on public.beneficiaries;

create policy "Profiles are viewable by Privy owner"
on public.profiles for select to authenticated
using (privy_user_id = (select auth.jwt()->>'sub'));

create policy "Profiles are insertable by Privy owner"
on public.profiles for insert to authenticated
with check (privy_user_id = (select auth.jwt()->>'sub'));

create policy "Profiles are updatable by Privy owner"
on public.profiles for update to authenticated
using (privy_user_id = (select auth.jwt()->>'sub'))
with check (privy_user_id = (select auth.jwt()->>'sub'));

create policy "Security preferences are viewable by Privy owner"
on public.profile_security_preferences for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Security preferences are insertable by Privy owner"
on public.profile_security_preferences for insert to authenticated
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Security preferences are updatable by Privy owner"
on public.profile_security_preferences for update to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Beneficiaries are viewable by Privy owner"
on public.beneficiaries for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Beneficiaries are insertable by Privy owner"
on public.beneficiaries for insert to authenticated
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Beneficiaries are updatable by Privy owner"
on public.beneficiaries for update to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));

create policy "Beneficiaries are deletable by Privy owner"
on public.beneficiaries for delete to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_id
    and profiles.privy_user_id = (select auth.jwt()->>'sub')
));
