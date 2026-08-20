-- Future With You V0.5 Alpha 3
-- Make couple creation safe to retry after a timeout, lost response, or rapid
-- double tap. A user can own only one active membership, so repeated calls
-- return that existing couple instead of reporting a false failure.

begin;

create or replace function public.create_couple_space(space_name text, space_greeting text default '')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id text := auth.uid();
  existing_couple_id uuid;
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

  -- Serialize creation for this authenticated user. This closes the small
  -- window where two taps can both observe no membership before inserting.
  perform pg_advisory_xact_lock(hashtext(current_user_id));

  select member.couple_id
    into existing_couple_id
    from public.couple_members member
    join public.couples couple on couple.id = member.couple_id
    where member.user_id = current_user_id
      and member.left_at is null
      and couple.status = 'active'
    order by member.joined_at desc
    limit 1;

  if existing_couple_id is not null then
    return existing_couple_id;
  end if;

  -- A left-open membership pointing at an archived or missing space violates
  -- the schema invariant. Do not silently delete or reassign relationship data.
  if exists (
    select 1 from public.couple_members member
    where member.user_id = current_user_id and member.left_at is null
  ) then
    raise exception 'The user has an inconsistent couple membership.';
  end if;

  insert into public.couples(name, greeting, created_by)
  values (trim(space_name), coalesce(space_greeting, ''), current_user_id)
  returning id into new_couple_id;

  insert into public.couple_members(couple_id, user_id, role, member_slot)
  values (new_couple_id, current_user_id, 'owner', 1);
  return new_couple_id;
end;
$$;

revoke all on function public.create_couple_space(text, text) from public, anon;
grant execute on function public.create_couple_space(text, text) to authenticated;

commit;
