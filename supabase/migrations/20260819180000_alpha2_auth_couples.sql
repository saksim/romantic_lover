-- Future With You V0.5 Alpha 2
-- Supabase Auth, profiles, couple workspaces, and one-time invite codes.

begin;

create extension if not exists pgcrypto with schema extensions;

revoke create on schema public from public;
grant usage on schema public to anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0)
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  greeting text not null default '' check (char_length(greeting) <= 240),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0)
);

create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  member_slot smallint not null check (member_slot in (1, 2)),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create unique index couple_members_one_active_couple_per_user
  on public.couple_members(user_id) where left_at is null;
create unique index couple_members_one_active_user_per_slot
  on public.couple_members(couple_id, member_slot) where left_at is null;
create index couple_members_active_couple
  on public.couple_members(couple_id, user_id) where left_at is null;

create table public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz
);

create index couple_invites_active_lookup
  on public.couple_invites(code_hash, expires_at)
  where redeemed_at is null and revoked_at is null;

create or replace function public.touch_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

create trigger profiles_touch_revision
before update on public.profiles
for each row execute function public.touch_revision();

create trigger couples_touch_revision
before update on public.couples
for each row execute function public.touch_revision();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(requested_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), '新的旅人'), 40)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger future_with_you_profile_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (user_id, display_name)
select
  auth_user.id,
  left(coalesce(
    nullif(trim(coalesce(auth_user.raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    '新的旅人'
  ), 40)
from auth.users auth_user
on conflict (user_id) do nothing;

create or replace function public.is_active_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members member
    join public.couples couple on couple.id = member.couple_id
    where member.couple_id = target_couple_id
      and member.user_id = (select auth.uid())
      and member.left_at is null
      and couple.status = 'active'
  );
$$;

create or replace function public.shares_active_couple(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    join public.couples couple on couple.id = mine.couple_id
    where mine.user_id = (select auth.uid())
      and mine.left_at is null
      and theirs.user_id = target_user_id
      and theirs.left_at is null
      and couple.status = 'active'
  );
$$;

create or replace function public.hash_invite_code(code text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(extensions.digest(upper(trim(code)), 'sha256'), 'hex');
$$;

create or replace function public.create_couple_space(space_name text, space_greeting text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(coalesce(space_name, ''));
  normalized_greeting text := trim(coalesce(space_greeting, ''));
  new_couple_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if char_length(normalized_name) not between 1 and 80 then
    raise exception 'Couple name must contain between 1 and 80 characters.';
  end if;
  if char_length(normalized_greeting) > 240 then
    raise exception 'Greeting must contain at most 240 characters.';
  end if;
  if exists (
    select 1 from public.couple_members member
    where member.user_id = current_user_id and member.left_at is null
  ) then
    raise exception 'The user already belongs to an active couple.';
  end if;

  insert into public.couples (name, greeting, created_by)
  values (normalized_name, normalized_greeting, current_user_id)
  returning id into new_couple_id;

  insert into public.couple_members (couple_id, user_id, role, member_slot)
  values (new_couple_id, current_user_id, 'owner', 1);

  return new_couple_id;
end;
$$;

create or replace function public.create_couple_invite(target_couple_id uuid)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  plain_code text;
  expiry timestamptz := now() + interval '20 minutes';
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.is_active_couple_member(target_couple_id) then
    raise exception 'Active couple membership required.';
  end if;

  perform 1
  from public.couples couple
  where couple.id = target_couple_id and couple.status = 'active'
  for update;
  if not found then
    raise exception 'The couple space is unavailable.';
  end if;

  if (
    select count(*) from public.couple_members member
    where member.couple_id = target_couple_id and member.left_at is null
  ) >= 2 then
    raise exception 'This couple space already has two active members.';
  end if;

  update public.couple_invites invite
  set revoked_at = now()
  where invite.couple_id = target_couple_id
    and invite.redeemed_at is null
    and invite.revoked_at is null;

  plain_code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  insert into public.couple_invites (couple_id, code_hash, created_by, expires_at)
  values (target_couple_id, public.hash_invite_code(plain_code), auth.uid(), expiry);

  return query select plain_code, expiry;
end;
$$;

create or replace function public.join_couple_by_code(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := upper(trim(coalesce(invite_code, '')));
  target_couple_id uuid;
  invite_record public.couple_invites%rowtype;
  available_slot smallint;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if char_length(normalized_code) <> 10 or normalized_code !~ '^[0-9A-F]{10}$' then
    raise exception 'Invite code is invalid or expired.';
  end if;
  if exists (
    select 1 from public.couple_members member
    where member.user_id = current_user_id and member.left_at is null
  ) then
    raise exception 'Leave the current couple before joining another one.';
  end if;

  select invite.couple_id into target_couple_id
  from public.couple_invites invite
  where invite.code_hash = public.hash_invite_code(normalized_code)
    and invite.expires_at > now()
    and invite.redeemed_at is null
    and invite.revoked_at is null;

  if target_couple_id is null then
    raise exception 'Invite code is invalid or expired.';
  end if;

  perform 1
  from public.couples couple
  where couple.id = target_couple_id and couple.status = 'active'
  for update;
  if not found then
    raise exception 'The couple space is unavailable.';
  end if;

  select invite.* into invite_record
  from public.couple_invites invite
  where invite.code_hash = public.hash_invite_code(normalized_code)
    and invite.expires_at > now()
    and invite.redeemed_at is null
    and invite.revoked_at is null
  for update;
  if not found then
    raise exception 'Invite code is invalid or expired.';
  end if;

  if (
    select count(*) from public.couple_members member
    where member.couple_id = target_couple_id and member.left_at is null
  ) >= 2 then
    raise exception 'This couple space already has two active members.';
  end if;

  select case when exists (
    select 1 from public.couple_members member
    where member.couple_id = target_couple_id
      and member.member_slot = 1
      and member.left_at is null
  ) then 2 else 1 end
  into available_slot;

  insert into public.couple_members (couple_id, user_id, role, member_slot)
  values (target_couple_id, current_user_id, 'partner', available_slot);

  update public.couple_invites invite
  set redeemed_by = current_user_id, redeemed_at = now()
  where invite.id = invite_record.id;

  return target_couple_id;
end;
$$;

create or replace function public.leave_couple_space(target_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform 1 from public.couples couple where couple.id = target_couple_id for update;
  if not found then
    raise exception 'The couple space is unavailable.';
  end if;

  update public.couple_members member
  set left_at = now()
  where member.couple_id = target_couple_id
    and member.user_id = current_user_id
    and member.left_at is null;
  if not found then
    raise exception 'Active couple membership required.';
  end if;

  update public.couple_invites invite
  set revoked_at = now()
  where invite.couple_id = target_couple_id
    and invite.redeemed_at is null
    and invite.revoked_at is null;

  if not exists (
    select 1 from public.couple_members member
    where member.couple_id = target_couple_id and member.left_at is null
  ) then
    update public.couples couple
    set status = 'archived'
    where couple.id = target_couple_id;
  else
    update public.couple_members member
    set role = 'owner'
    where member.id = (
      select remaining.id
      from public.couple_members remaining
      where remaining.couple_id = target_couple_id and remaining.left_at is null
      order by remaining.joined_at, remaining.id
      limit 1
    );
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (user_id = (select auth.uid()) or public.shares_active_couple(user_id));

create policy profiles_update on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy couples_select on public.couples
for select to authenticated
using (public.is_active_couple_member(id));

create policy couple_members_select on public.couple_members
for select to authenticated
using (public.is_active_couple_member(couple_id));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.couples from anon, authenticated;
revoke all on table public.couple_members from anon, authenticated;
revoke all on table public.couple_invites from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path) on table public.profiles to authenticated;
grant select on table public.couples to authenticated;
grant select on table public.couple_members to authenticated;

revoke all on function public.touch_revision() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.hash_invite_code(text) from public, anon, authenticated;
revoke all on function public.is_active_couple_member(uuid) from public, anon;
revoke all on function public.shares_active_couple(uuid) from public, anon;
revoke all on function public.create_couple_space(text, text) from public, anon;
revoke all on function public.create_couple_invite(uuid) from public, anon;
revoke all on function public.join_couple_by_code(text) from public, anon;
revoke all on function public.leave_couple_space(uuid) from public, anon;

grant execute on function public.is_active_couple_member(uuid) to authenticated;
grant execute on function public.shares_active_couple(uuid) to authenticated;
grant execute on function public.create_couple_space(text, text) to authenticated;
grant execute on function public.create_couple_invite(uuid) to authenticated;
grant execute on function public.join_couple_by_code(text) to authenticated;
grant execute on function public.leave_couple_space(uuid) to authenticated;

commit;
