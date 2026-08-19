-- Future With You V0.5.0 cloud foundation.
-- Target: a NEW Tencent CloudBase PG-mode environment.
-- This migration is version-controlled but must not be applied to production
-- until it has passed the RLS and migration rehearsals in docs/V0.5.0_ARCHITECTURE.md.

begin;

create extension if not exists pgcrypto;

create table public.profiles (
  user_id varchar(64) primary key,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0)
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  greeting text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0)
);

create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  user_id varchar(64) not null,
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
  couple_id uuid not null references public.couples(id),
  code_hash text not null unique,
  created_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_by varchar(64),
  redeemed_at timestamptz,
  revoked_at timestamptz
);

create index couple_invites_active_lookup
  on public.couple_invites(code_hash, expires_at)
  where redeemed_at is null and revoked_at is null;

create table public.wishes (
  couple_id uuid not null references public.couples(id),
  id text not null,
  category text not null check (category in ('daily', 'adventure', 'romance', 'growth', 'home')),
  title text not null,
  description text not null default '',
  moment text not null default '',
  source text not null check (source in ('curated', 'custom', 'date-idea')),
  saved boolean not null default false,
  completed boolean not null default false,
  completed_at date,
  planned_for date,
  setting text check (setting in ('home', 'out', 'either')),
  duration text check (duration in ('quick', 'evening', 'day')),
  note text,
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id)
);

create index wishes_couple_updated on public.wishes(couple_id, updated_at);

create table public.memories (
  couple_id uuid not null references public.couples(id),
  id text not null,
  title text not null,
  story text not null default '',
  occurred_at date not null,
  kind text not null check (kind in ('milestone', 'date', 'trip', 'gift', 'ordinary', 'conversation')),
  creator_label text not null check (creator_label in ('me', 'partner', 'together')),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  location text,
  linked_wish_id text,
  featured boolean not null default false,
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id),
  foreign key (couple_id, linked_wish_id)
    references public.wishes(couple_id, id)
    deferrable initially deferred
);

create index memories_couple_occurred on public.memories(couple_id, occurred_at desc);
create index memories_couple_updated on public.memories(couple_id, updated_at);

create table public.memory_media (
  couple_id uuid not null,
  id text not null,
  memory_id text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  alt text not null default '',
  sort_order integer not null default 0,
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id),
  foreign key (couple_id, memory_id)
    references public.memories(couple_id, id)
    deferrable initially deferred
);

create unique index memory_media_unique_path
  on public.memory_media(storage_path) where deleted_at is null;

create table public.daily_answers (
  couple_id uuid not null references public.couples(id),
  id text not null,
  question_id text not null,
  date_key date not null,
  user_id varchar(64) not null default auth.uid(),
  answer text not null default '',
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id),
  unique (couple_id, question_id, date_key, user_id)
);

create table public.anniversaries (
  couple_id uuid not null references public.couples(id),
  id text not null,
  title text not null,
  anniversary_date date not null,
  recurrence text not null default 'yearly' check (recurrence in ('none', 'yearly')),
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id)
);

create table public.time_capsules (
  couple_id uuid not null references public.couples(id),
  id text not null,
  title text not null,
  message text not null,
  open_at timestamptz not null,
  opened_at timestamptz,
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id)
);

create table public.notifications (
  couple_id uuid not null references public.couples(id),
  id text not null,
  recipient_user_id varchar(64) not null,
  actor_user_id varchar(64) not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_by varchar(64) not null default auth.uid(),
  updated_by varchar(64) not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  primary key (couple_id, id)
);

create index notifications_recipient_unread
  on public.notifications(recipient_user_id, created_at desc)
  where read_at is null and deleted_at is null;

create table public.migration_runs (
  migration_id text primary key,
  couple_id uuid not null references public.couples(id),
  user_id varchar(64) not null default auth.uid(),
  source_version integer not null,
  source_hash text not null,
  status text not null check (status in ('planned', 'uploading', 'verifying', 'completed', 'failed')),
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (couple_id, user_id, source_hash)
);

create table public.sync_operations (
  operation_id text primary key,
  couple_id uuid not null references public.couples(id),
  user_id varchar(64) not null default auth.uid(),
  entity_type text not null,
  entity_id text not null,
  status text not null check (status in ('applied', 'conflict', 'rejected')),
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sync_events (
  sequence bigserial primary key,
  couple_id uuid not null references public.couples(id),
  entity_type text not null,
  entity_id text not null,
  mutation_kind text not null check (mutation_kind in ('upsert', 'delete')),
  revision bigint not null,
  actor_user_id varchar(64) not null,
  created_at timestamptz not null default now()
);

create index sync_events_couple_sequence on public.sync_events(couple_id, sequence);

create or replace function public.is_active_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.couple_members member
    join public.couples couple on couple.id = member.couple_id
    where member.couple_id = target_couple_id
      and member.user_id = auth.uid()
      and member.left_at is null
      and couple.status = 'active'
  );
$$;

create or replace function public.shares_active_couple(target_user_id varchar)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    join public.couples couple on couple.id = mine.couple_id
    where mine.user_id = auth.uid()
      and mine.left_at is null
      and theirs.user_id = target_user_id
      and theirs.left_at is null
      and couple.status = 'active'
  );
$$;

create or replace function public.set_row_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_json jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.revision := 1;
    if auth.uid() is not null and row_json ? 'created_by' then
      new.created_by := auth.uid();
    end if;
    if auth.uid() is not null and row_json ? 'updated_by' then
      new.updated_by := auth.uid();
    end if;
    return new;
  end if;

  new.updated_at := now();
  new.revision := old.revision + 1;
  if row_json ? 'couple_id' then
    new.couple_id := old.couple_id;
  end if;
  if row_json ? 'id' then
    new.id := old.id;
  end if;
  if row_json ? 'user_id' then
    new.user_id := old.user_id;
  end if;
  if row_json ? 'created_by' then
    new.created_by := old.created_by;
  end if;
  if auth.uid() is not null and row_json ? 'updated_by' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.emit_sync_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_json jsonb := to_jsonb(new);
  actor text;
begin
  actor := coalesce(auth.uid(), row_json ->> 'updated_by', row_json ->> 'created_by');
  if actor is null then
    raise exception 'A sync event requires an actor.';
  end if;

  insert into public.sync_events (
    couple_id,
    entity_type,
    entity_id,
    mutation_kind,
    revision,
    actor_user_id
  ) values (
    new.couple_id,
    tg_argv[0],
    new.id,
    case when new.deleted_at is null then 'upsert' else 'delete' end,
    new.revision,
    actor
  );
  return new;
end;
$$;

create trigger profiles_set_metadata before insert or update on public.profiles
for each row execute function public.set_row_metadata();
create trigger couples_set_metadata before insert or update on public.couples
for each row execute function public.set_row_metadata();

do $$
declare
  table_name text;
  entity_name text;
begin
  foreach table_name in array array[
    'wishes', 'memories', 'memory_media', 'daily_answers',
    'anniversaries', 'time_capsules', 'notifications'
  ] loop
    execute format(
      'create trigger %I_set_metadata before insert or update on public.%I for each row execute function public.set_row_metadata()',
      table_name,
      table_name
    );
  end loop;

  for table_name, entity_name in
    select * from (values
      ('wishes', 'wish'),
      ('memories', 'memory'),
      ('memory_media', 'memory_media'),
      ('daily_answers', 'daily_answer'),
      ('anniversaries', 'anniversary'),
      ('time_capsules', 'time_capsule'),
      ('notifications', 'notification')
    ) as entities(table_name, entity_name)
  loop
    execute format(
      'create trigger %I_emit_sync_event after insert or update on public.%I for each row execute function public.emit_sync_event(%L)',
      table_name,
      table_name,
      entity_name
    );
  end loop;
end;
$$;

create or replace function public.hash_invite_code(code text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(digest(upper(trim(code)), 'sha256'), 'hex');
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
  if current_user_id is null then raise exception 'Authentication required.'; end if;
  if exists (select 1 from public.couple_members member where member.user_id = current_user_id and member.left_at is null) then
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
  if current_user_id is null then raise exception 'Authentication required.'; end if;
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
  if (select count(*) from public.couple_members member
      where member.couple_id = invite_record.couple_id and member.left_at is null) >= 2 then
    raise exception 'This couple space already has two active members.';
  end if;

  select case
    when exists (
      select 1 from public.couple_members member
      where member.couple_id = invite_record.couple_id and member.member_slot = 1 and member.left_at is null
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

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;
alter table public.wishes enable row level security;
alter table public.memories enable row level security;
alter table public.memory_media enable row level security;
alter table public.daily_answers enable row level security;
alter table public.anniversaries enable row level security;
alter table public.time_capsules enable row level security;
alter table public.notifications enable row level security;
alter table public.migration_runs enable row level security;
alter table public.sync_operations enable row level security;
alter table public.sync_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.shares_active_couple(user_id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy couples_select on public.couples for select to authenticated
  using (public.is_active_couple_member(id));
create policy couple_members_select on public.couple_members for select to authenticated
  using (public.is_active_couple_member(couple_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wishes', 'memories', 'memory_media', 'anniversaries', 'time_capsules'
  ] loop
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.is_active_couple_member(couple_id))',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (public.is_active_couple_member(couple_id) and created_by = auth.uid())',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (public.is_active_couple_member(couple_id)) with check (public.is_active_couple_member(couple_id))',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create policy daily_answers_select on public.daily_answers for select to authenticated
  using (public.is_active_couple_member(couple_id));
create policy daily_answers_insert on public.daily_answers for insert to authenticated
  with check (public.is_active_couple_member(couple_id) and user_id = auth.uid() and created_by = auth.uid());
create policy daily_answers_update on public.daily_answers for update to authenticated
  using (public.is_active_couple_member(couple_id) and user_id = auth.uid())
  with check (public.is_active_couple_member(couple_id) and user_id = auth.uid());

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid() and public.is_active_couple_member(couple_id));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_user_id = auth.uid() and public.is_active_couple_member(couple_id))
  with check (recipient_user_id = auth.uid() and public.is_active_couple_member(couple_id));

create policy migration_runs_select on public.migration_runs for select to authenticated
  using (user_id = auth.uid() and public.is_active_couple_member(couple_id));
create policy migration_runs_insert on public.migration_runs for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_couple_member(couple_id));
create policy migration_runs_update on public.migration_runs for update to authenticated
  using (user_id = auth.uid() and public.is_active_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_active_couple_member(couple_id));

create policy sync_events_select on public.sync_events for select to authenticated
  using (public.is_active_couple_member(couple_id));

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.couples, public.couple_members to authenticated;
grant select, insert, update on public.wishes, public.memories, public.memory_media,
  public.daily_answers, public.anniversaries, public.time_capsules to authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant select, insert, update on public.migration_runs to authenticated;
grant select on public.sync_events to authenticated;

revoke all on function public.hash_invite_code(text) from public;
revoke all on function public.create_couple_space(text, text) from public;
revoke all on function public.create_couple_invite(uuid) from public;
revoke all on function public.join_couple_by_code(text) from public;
revoke all on function public.leave_couple_space(uuid) from public;
grant execute on function public.is_active_couple_member(uuid) to authenticated;
grant execute on function public.shares_active_couple(varchar) to authenticated;
grant execute on function public.create_couple_space(text, text) to authenticated;
grant execute on function public.create_couple_invite(uuid) to authenticated;
grant execute on function public.join_couple_by_code(text) to authenticated;
grant execute on function public.leave_couple_space(uuid) to authenticated;

commit;
