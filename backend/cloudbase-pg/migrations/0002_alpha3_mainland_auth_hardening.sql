-- Future With You V0.5 Alpha 3
-- CloudBase PostgREST currently exposes RPC endpoints independently of GRANT EXECUTE.
-- Every SECURITY DEFINER mutation therefore validates the JWT role inside the function.

begin;

create or replace function public.is_authenticated_request()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    ) = 'authenticated';
$$;

create or replace function public.create_couple_space(space_name text, space_greeting text default '')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id text := auth.uid();
  new_couple_id uuid;
begin
  if not public.is_authenticated_request() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if nullif(btrim(space_name), '') is null or char_length(btrim(space_name)) > 80 then
    raise exception 'Space name must contain between 1 and 80 characters.' using errcode = '22023';
  end if;
  if char_length(coalesce(space_greeting, '')) > 240 then
    raise exception 'Space greeting must contain at most 240 characters.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.couple_members member
    where member.user_id = current_user_id and member.left_at is null
  ) then
    raise exception 'The user already belongs to an active couple.';
  end if;

  insert into public.couples(name, greeting, created_by)
  values (trim(space_name), coalesce(space_greeting, ''), current_user_id)
  returning id into new_couple_id;

  insert into public.couple_members(couple_id, user_id, role, member_slot)
  values (new_couple_id, current_user_id, 'owner', 1);
  return new_couple_id;
end;
$$;

create or replace function public.create_couple_invite(target_couple_id uuid)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  plain_code text;
  expiry timestamptz := now() + interval '20 minutes';
begin
  if not public.is_authenticated_request() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.is_active_couple_member(target_couple_id) then
    raise exception 'Active couple membership required.';
  end if;

  perform 1 from public.couples where id = target_couple_id for update;
  update public.couple_invites
    set revoked_at = now()
    where couple_id = target_couple_id and redeemed_at is null and revoked_at is null;

  plain_code := upper(encode(gen_random_bytes(5), 'hex'));
  insert into public.couple_invites(couple_id, code_hash, created_by, expires_at)
  values (target_couple_id, public.hash_invite_code(plain_code), auth.uid(), expiry);
  return query select plain_code, expiry;
end;
$$;

create or replace function public.join_couple_by_code(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id text := auth.uid();
  invite_record public.couple_invites%rowtype;
  available_slot smallint;
begin
  if not public.is_authenticated_request() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.couple_members member
    where member.user_id = current_user_id and member.left_at is null
  ) then
    raise exception 'Leave the current couple before joining another one.';
  end if;

  select * into invite_record
  from public.couple_invites invite
  where invite.code_hash = public.hash_invite_code(invite_code)
    and invite.expires_at > now()
    and invite.redeemed_at is null
    and invite.revoked_at is null
  for update;

  if not found then raise exception 'Invite code is invalid or expired.'; end if;
  if (
    select count(*) from public.couple_members member
    where member.couple_id = invite_record.couple_id and member.left_at is null
  ) >= 2 then
    raise exception 'This couple space already has two active members.';
  end if;

  select case
    when exists (
      select 1 from public.couple_members member
      where member.couple_id = invite_record.couple_id
        and member.member_slot = 1
        and member.left_at is null
    ) then 2 else 1 end
  into available_slot;

  insert into public.couple_members(couple_id, user_id, role, member_slot)
  values (invite_record.couple_id, current_user_id, 'partner', available_slot);
  update public.couple_invites
    set redeemed_by = current_user_id, redeemed_at = now()
    where id = invite_record.id;
  return invite_record.couple_id;
end;
$$;

create or replace function public.leave_couple_space(target_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id text := auth.uid();
begin
  if not public.is_authenticated_request() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.couple_members
    set left_at = now()
    where couple_id = target_couple_id
      and user_id = current_user_id
      and left_at is null;
  if not found then raise exception 'Active couple membership required.'; end if;

  update public.couple_invites
    set revoked_at = now()
    where couple_id = target_couple_id
      and redeemed_at is null
      and revoked_at is null;

  if not exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and left_at is null
  ) then
    update public.couples set status = 'archived' where id = target_couple_id;
  else
    update public.couple_members
      set role = 'owner'
      where id = (
        select id from public.couple_members
        where couple_id = target_couple_id and left_at is null
        order by joined_at limit 1
      );
  end if;
end;
$$;

revoke all on function public.is_authenticated_request() from public, anon, authenticated;
revoke all on function public.create_couple_space(text, text) from public, anon;
revoke all on function public.create_couple_invite(uuid) from public, anon;
revoke all on function public.join_couple_by_code(text) from public, anon;
revoke all on function public.leave_couple_space(uuid) from public, anon;

grant execute on function public.create_couple_space(text, text) to authenticated;
grant execute on function public.create_couple_invite(uuid) to authenticated;
grant execute on function public.join_couple_by_code(text) to authenticated;
grant execute on function public.leave_couple_space(uuid) to authenticated;

commit;
