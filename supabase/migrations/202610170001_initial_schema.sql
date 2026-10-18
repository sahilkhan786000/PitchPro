create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 80),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 60),
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 2000),
  logo_path text,
  status text not null default 'active' check (status in ('active', 'completed')),
  format text not null default 'double_round_robin_final' check (format = 'double_round_robin_final'),
  start_date date,
  end_date date,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);
create table public.tournament_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'read_only')),
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);
create table public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  seed integer check (seed is null or seed > 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, team_id)
);
create table public.matchdays (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  scheduled_date date,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_number)
);
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  matchday_id uuid references public.matchdays(id) on delete restrict,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  stage text not null default 'league' check (stage in ('league', 'final')),
  status text not null default 'pending' check (status in ('pending', 'played')),
  scheduled_at timestamptz,
  played_at timestamptz,
  home_score integer,
  away_score integer,
  notes text check (notes is null or char_length(notes) <= 500),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check ((status = 'played' and home_score is not null and away_score is not null and home_score >= 0 and away_score >= 0)
    or (status = 'pending' and home_score is null and away_score is null)),
  unique (matchday_id, home_team_id, away_team_id)
);
create unique index fixtures_one_final_per_tournament on public.fixtures (tournament_id) where stage = 'final';
create index fixtures_tournament_matchday_idx on public.fixtures (tournament_id, matchday_id);
create index fixtures_tournament_status_idx on public.fixtures (tournament_id, status, stage);
create table public.goal_events (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  scorer_name text check (scorer_name is null or char_length(scorer_name) <= 80),
  minute integer check (minute is null or minute between 0 and 130),
  goal_type text not null default 'regular' check (goal_type in ('regular', 'penalty', 'own_goal')),
  created_at timestamptz not null default now()
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.tournament_invitations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  invite_token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_ticket text,
  error_message text,
  attempted_at timestamptz not null default now(),
  primary key (notification_id, device_id)
);
create index tournaments_owner_idx on public.tournaments (owner_id, created_at desc);
create index tournament_members_user_idx on public.tournament_members (user_id, tournament_id);
create index tournament_teams_team_idx on public.tournament_teams (team_id);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index activity_tournament_created_idx on public.activity_events (tournament_id, created_at desc);
create index goal_events_fixture_idx on public.goal_events (fixture_id, created_at);
alter table public.fixtures replica identity full;
alter publication supabase_realtime add table public.fixtures, public.activity_events, public.notifications;

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger tournaments_updated_at before update on public.tournaments for each row execute function public.set_updated_at();
create trigger fixtures_updated_at before update on public.fixtures for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'New Manager'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.is_tournament_member(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournament_members tm where tm.tournament_id = p_tournament_id and tm.user_id = auth.uid());
$$;
create function public.is_tournament_owner(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments t where t.id = p_tournament_id and t.owner_id = auth.uid());
$$;
create function public.add_tournament_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tournament_members (tournament_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger tournament_owner_membership after insert on public.tournaments for each row execute function public.add_tournament_owner();

create function public.protect_tournament_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() or new.status <> 'active' then
      raise exception 'New tournaments must be created active by their authenticated owner.' using errcode = '42501';
    end if;
    return new;
  end if;
  if current_user = 'authenticated' and new.status is distinct from old.status then
    raise exception 'Tournament status is managed by final-result workflows.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tournament_status_guard before insert or update on public.tournaments
for each row execute function public.protect_tournament_status();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_members enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.matchdays enable row level security;
alter table public.fixtures enable row level security;
alter table public.goal_events enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.tournament_invitations enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;
alter table public.push_deliveries enable row level security;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_read_shared_tournament_members on public.profiles for select to authenticated using (
  exists (select 1 from public.tournament_members member
    where member.user_id = public.profiles.id and public.is_tournament_member(member.tournament_id))
);
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy teams_read_authenticated on public.teams for select to authenticated using (true);
create policy teams_insert_owner on public.teams for insert to authenticated with check (owner_id = auth.uid());
create policy teams_update_owner on public.teams for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy tournaments_read_member on public.tournaments for select to authenticated using (public.is_tournament_member(id));
create policy tournaments_insert_owner on public.tournaments for insert to authenticated with check (owner_id = auth.uid());
create policy tournaments_update_owner on public.tournaments for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy members_read_member on public.tournament_members for select to authenticated using (public.is_tournament_member(tournament_id));
create policy invitations_read_owner on public.tournament_invitations for select to authenticated using (public.is_tournament_owner(tournament_id));
create policy tournament_teams_read_member on public.tournament_teams for select to authenticated using (public.is_tournament_member(tournament_id));
create policy tournament_teams_insert_owner on public.tournament_teams for insert to authenticated with check (
  public.is_tournament_owner(tournament_id) and not exists (
    select 1 from public.fixtures f where f.tournament_id = public.tournament_teams.tournament_id
  )
);
create policy tournament_teams_delete_owner on public.tournament_teams for delete to authenticated using (
  public.is_tournament_owner(tournament_id) and not exists (
    select 1 from public.fixtures f where f.tournament_id = public.tournament_teams.tournament_id
  )
);
create policy matchdays_read_member on public.matchdays for select to authenticated using (public.is_tournament_member(tournament_id));
create policy fixtures_read_member on public.fixtures for select to authenticated using (public.is_tournament_member(tournament_id));
create policy goals_read_member on public.goal_events for select to authenticated using (
  exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_tournament_member(f.tournament_id))
);
create policy activity_read_member on public.activity_events for select to authenticated using (public.is_tournament_member(tournament_id));
create policy notifications_read_recipient on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy preferences_manage_self on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_devices_manage_self on public.push_devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.create_team(p_name text, p_logo_path text default null)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare v_team public.teams%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'Team name must be between 1 and 60 characters.' using errcode = '22023'; end if;
  if p_logo_path is not null and split_part(p_logo_path, '/', 1) <> auth.uid()::text then
    raise exception 'Logo path must belong to the authenticated user.' using errcode = '42501';
  end if;
  insert into public.teams (owner_id, name, logo_path) values (auth.uid(), trim(p_name), p_logo_path) returning * into v_team;
  return v_team;
end;
$$;

create function public.create_tournament_with_teams(
  p_name text, p_description text, p_start_date date, p_end_date date, p_timezone text, p_team_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tournament_id uuid; v_team_count integer; v_unique_count integer; v_timezone text;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 100 then raise exception 'Tournament name is required.' using errcode = '22023'; end if;
  if coalesce(array_length(p_team_ids, 1), 0) < 2 then raise exception 'Select at least two teams.' using errcode = '22023'; end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then raise exception 'End date must not be before start date.' using errcode = '22023'; end if;
  v_timezone := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then raise exception 'Unknown time zone.' using errcode = '22023'; end if;
  select count(*), count(distinct id) into v_team_count, v_unique_count
  from public.teams where id = any(p_team_ids);
  if v_team_count <> array_length(p_team_ids, 1) or v_unique_count <> v_team_count then
    raise exception 'Every selected team must exist and be unique.' using errcode = '22023';
  end if;
  insert into public.tournaments (owner_id, name, description, start_date, end_date, timezone)
  values (auth.uid(), trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_start_date, p_end_date, v_timezone)
  returning id into v_tournament_id;
  insert into public.tournament_teams (tournament_id, team_id, seed)
  select v_tournament_id, team_id, ordinality::integer from unnest(p_team_ids) with ordinality as selected(team_id, ordinality);
  insert into public.activity_events (tournament_id, actor_id, event_type, metadata)
  values (v_tournament_id, auth.uid(), 'tournament_created', jsonb_build_object('team_count', v_team_count));
  return v_tournament_id;
end;
$$;

create function public.create_tournament_invite(p_tournament_id uuid, p_expires_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if auth.uid() is null or not public.is_tournament_owner(p_tournament_id) then raise exception 'Only the owner can invite members.' using errcode = '42501'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then raise exception 'Invitation expiry must be within 30 days.' using errcode = '22023'; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.tournament_invitations (tournament_id, created_by, invite_token_hash, expires_at)
  values (p_tournament_id, auth.uid(), encode(extensions.digest(v_token, 'sha256'), 'hex'), p_expires_at);
  return v_token;
end;
$$;
create function public.accept_tournament_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.tournament_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  select * into v_invite from public.tournament_invitations
  where invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and revoked_at is null and accepted_at is null and expires_at > now()
  for update;
  if not found then raise exception 'Invitation is invalid, expired, or already used.' using errcode = '22023'; end if;
  insert into public.tournament_members (tournament_id, user_id, role) values (v_invite.tournament_id, auth.uid(), 'read_only')
  on conflict (tournament_id, user_id) do nothing;
  update public.tournament_invitations set accepted_by = auth.uid(), accepted_at = now() where id = v_invite.id;
  return v_invite.tournament_id;
end;
$$;
create function public.revoke_tournament_invite(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.tournament_invitations set revoked_at = now()
  where id = p_invitation_id and created_by = auth.uid() and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Invitation not found or already used.' using errcode = '22023'; end if;
end;
$$;
create function public.revoke_tournament_member(p_tournament_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_tournament_owner(p_tournament_id) then raise exception 'Only the owner can remove members.' using errcode = '42501'; end if;
  delete from public.tournament_members where tournament_id = p_tournament_id and user_id = p_user_id and role = 'read_only';
  if not found then raise exception 'Read-only member not found.' using errcode = '22023'; end if;
  insert into public.activity_events (tournament_id, actor_id, event_type, metadata)
  values (p_tournament_id, auth.uid(), 'member_removed', jsonb_build_object('member_id', p_user_id));
end;
$$;

create function public.generate_league_fixtures(p_tournament_id uuid, p_fixtures jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_team_count integer; v_round_count integer; v_expected_count integer; v_matchday_size integer; v_created integer;
begin
  if auth.uid() is null or not public.is_tournament_owner(p_tournament_id) then raise exception 'Only the owner can generate fixtures.' using errcode = '42501'; end if;
  if jsonb_typeof(p_fixtures) <> 'array' then raise exception 'Fixtures must be an array.' using errcode = '22023'; end if;
  if exists (select 1 from public.fixtures where tournament_id = p_tournament_id) then raise exception 'Fixtures already exist.' using errcode = '22023'; end if;
  select count(*) into v_team_count from public.tournament_teams where tournament_id = p_tournament_id;
  if v_team_count < 2 then raise exception 'At least two teams are required.' using errcode = '22023'; end if;
  v_expected_count := v_team_count * (v_team_count - 1);
  v_round_count := case when v_team_count % 2 = 0 then 2 * (v_team_count - 1) else 2 * v_team_count end;
  v_matchday_size := floor(v_team_count::numeric / 2)::integer;
  if jsonb_array_length(p_fixtures) <> v_expected_count then raise exception 'Fixture count does not match the selected teams.' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_fixtures) e
    where (e.value ->> 'home_team_id') is null or (e.value ->> 'away_team_id') is null
      or (e.value ->> 'round_number')::integer not between 1 and v_round_count
      or (e.value ->> 'home_team_id')::uuid = (e.value ->> 'away_team_id')::uuid
      or not exists (select 1 from public.tournament_teams tt where tt.tournament_id = p_tournament_id and tt.team_id = (e.value ->> 'home_team_id')::uuid)
      or not exists (select 1 from public.tournament_teams tt where tt.tournament_id = p_tournament_id and tt.team_id = (e.value ->> 'away_team_id')::uuid)
  ) then raise exception 'Fixture contains an invalid participant or matchday.' using errcode = '22023'; end if;
  if exists (
    with parsed as (select (value ->> 'home_team_id')::uuid home_id, (value ->> 'away_team_id')::uuid away_id from jsonb_array_elements(p_fixtures))
    select 1 from parsed group by least(home_id, away_id), greatest(home_id, away_id)
    having count(*) <> 2 or count(*) filter (where home_id = least(home_id, away_id)) <> 1
  ) then raise exception 'Each pair must occur once in each home/away orientation.' using errcode = '22023'; end if;
  if exists (
    with parsed as (
      select (value ->> 'round_number')::integer round_number, (value ->> 'home_team_id')::uuid home_id, (value ->> 'away_team_id')::uuid away_id
      from jsonb_array_elements(p_fixtures)
    ), appearances as (select round_number, home_id team_id from parsed union all select round_number, away_id from parsed)
    select 1 from appearances group by round_number, team_id having count(*) > 1
  ) then raise exception 'A team cannot play more than once per matchday.' using errcode = '22023'; end if;
  if exists (
    select 1 from (select (value ->> 'round_number')::integer r, count(*) c from jsonb_array_elements(p_fixtures) group by 1) rounds where c <> v_matchday_size
  ) or (select count(distinct (value ->> 'round_number')::integer) from jsonb_array_elements(p_fixtures)) <> v_round_count
  then raise exception 'Matchday distribution is invalid.' using errcode = '22023'; end if;
  insert into public.matchdays (tournament_id, round_number)
  select p_tournament_id, r from (select distinct (value ->> 'round_number')::integer r from jsonb_array_elements(p_fixtures)) rounds;
  insert into public.fixtures (tournament_id, matchday_id, home_team_id, away_team_id)
  select p_tournament_id, md.id, (item.value ->> 'home_team_id')::uuid, (item.value ->> 'away_team_id')::uuid
  from jsonb_array_elements(p_fixtures) item join public.matchdays md
    on md.tournament_id = p_tournament_id and md.round_number = (item.value ->> 'round_number')::integer;
  get diagnostics v_created = row_count;
  insert into public.activity_events (tournament_id, actor_id, event_type, metadata)
  values (p_tournament_id, auth.uid(), 'fixtures_generated', jsonb_build_object('fixture_count', v_created, 'matchday_count', v_round_count));
  insert into public.notifications (recipient_id, tournament_id, actor_id, event_type, title, body)
  select tm.user_id, p_tournament_id, auth.uid(), 'fixtures_generated', 'Fixtures are ready', v_created || ' league matches have been added.'
  from public.tournament_members tm where tm.tournament_id = p_tournament_id and tm.user_id <> auth.uid();
  return v_created;
end;
$$;

create function public.save_fixture_result(
  p_fixture_id uuid, p_expected_version integer, p_status text, p_home_score integer, p_away_score integer,
  p_goal_events jsonb default '[]'::jsonb, p_notes text default null
)
returns public.fixtures language plpgsql security definer set search_path = '' as $$
declare
  v_fixture public.fixtures%rowtype; v_event_count integer; v_home_events integer; v_away_events integer; v_event jsonb;
  v_old_status text; v_old_home_score integer; v_old_away_score integer; v_previous_winner uuid; v_new_winner uuid;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found.' using errcode = 'P0002'; end if;
  v_old_status := v_fixture.status; v_old_home_score := v_fixture.home_score; v_old_away_score := v_fixture.away_score;
  if v_fixture.stage = 'final' and v_old_status = 'played' and v_old_home_score <> v_old_away_score then
    v_previous_winner := case when v_old_home_score > v_old_away_score then v_fixture.home_team_id else v_fixture.away_team_id end;
  end if;
  if auth.uid() is null or not public.is_tournament_owner(v_fixture.tournament_id) then raise exception 'Only the owner can save results.' using errcode = '42501'; end if;
  if v_fixture.version <> p_expected_version then raise exception 'Fixture changed elsewhere; refresh before saving.' using errcode = '40001'; end if;
  if p_status not in ('pending', 'played') then raise exception 'Invalid match status.' using errcode = '22023'; end if;
  if p_status = 'played' and (p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0) then raise exception 'Played matches require valid scores.' using errcode = '22023'; end if;
  if p_status = 'pending' and (p_home_score is not null or p_away_score is not null or jsonb_array_length(coalesce(p_goal_events, '[]'::jsonb)) > 0) then raise exception 'Pending matches cannot retain scores or goal events.' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_goal_events, '[]'::jsonb)) <> 'array' then raise exception 'Goal events must be an array.' using errcode = '22023'; end if;
  select count(*), count(*) filter (where (value ->> 'team_id')::uuid = v_fixture.home_team_id), count(*) filter (where (value ->> 'team_id')::uuid = v_fixture.away_team_id)
  into v_event_count, v_home_events, v_away_events from jsonb_array_elements(coalesce(p_goal_events, '[]'::jsonb));
  if v_event_count > 0 and (v_home_events <> p_home_score or v_away_events <> p_away_score) then raise exception 'Goal event totals must match the score.' using errcode = '22023'; end if;
  for v_event in select value from jsonb_array_elements(coalesce(p_goal_events, '[]'::jsonb)) loop
    if (v_event ->> 'team_id')::uuid not in (v_fixture.home_team_id, v_fixture.away_team_id)
      or coalesce(v_event ->> 'goal_type', 'regular') not in ('regular', 'penalty', 'own_goal')
      or ((v_event ->> 'minute') is not null and (v_event ->> 'minute')::integer not between 0 and 130)
      or ((v_event ->> 'scorer_name') is not null and char_length(v_event ->> 'scorer_name') > 80)
    then raise exception 'Invalid goal event.' using errcode = '22023'; end if;
  end loop;
  delete from public.goal_events where fixture_id = p_fixture_id;
  insert into public.goal_events (fixture_id, team_id, scorer_name, minute, goal_type)
  select p_fixture_id, (value ->> 'team_id')::uuid, nullif(value ->> 'scorer_name', ''), nullif(value ->> 'minute', '')::integer, coalesce(value ->> 'goal_type', 'regular')
  from jsonb_array_elements(coalesce(p_goal_events, '[]'::jsonb));
  update public.fixtures set status = p_status, home_score = p_home_score, away_score = p_away_score,
    played_at = case when p_status = 'pending' then null when v_old_status = 'pending' then now() else played_at end,
    notes = nullif(left(trim(coalesce(p_notes, '')), 500), ''),
    version = version + 1, updated_at = now()
  where id = p_fixture_id returning * into v_fixture;
  insert into public.activity_events (tournament_id, actor_id, event_type, entity_type, entity_id, metadata)
  values (v_fixture.tournament_id, auth.uid(), case when p_status = 'pending' then 'result_reverted' when v_fixture.version > 1 then 'result_corrected' else 'result_recorded' end,
    'fixture', p_fixture_id, jsonb_build_object('status', p_status, 'home_score', p_home_score, 'away_score', p_away_score, 'notes', left(coalesce(p_notes, ''), 500)));
  insert into public.notifications (recipient_id, tournament_id, actor_id, event_type, title, body, entity_type, entity_id)
  select tm.user_id, v_fixture.tournament_id, auth.uid(), 'result_updated',
    case when p_status = 'pending' then 'Match result reverted' else 'Match result updated' end,
    case when p_status = 'pending' then 'A match has returned to pending.' else p_home_score || ' - ' || p_away_score || ' result saved.' end,
    'fixture', p_fixture_id
  from public.tournament_members tm where tm.tournament_id = v_fixture.tournament_id and tm.user_id <> auth.uid();
  if v_fixture.stage = 'final' then
    update public.tournaments set status = case when p_status = 'played' and p_home_score <> p_away_score then 'completed' else 'active' end where id = v_fixture.tournament_id;
    if p_status = 'played' and p_home_score <> p_away_score then
      v_new_winner := case when p_home_score > p_away_score then v_fixture.home_team_id else v_fixture.away_team_id end;
    end if;
    if v_new_winner is not null and v_new_winner is distinct from v_previous_winner then
      insert into public.activity_events (tournament_id, actor_id, event_type, entity_type, entity_id, metadata)
      values (v_fixture.tournament_id, auth.uid(), case when v_previous_winner is null then 'champion_declared' else 'champion_changed' end,
        'fixture', p_fixture_id, jsonb_build_object('winner_team_id', v_new_winner));
      insert into public.notifications (recipient_id, tournament_id, actor_id, event_type, title, body, entity_type, entity_id)
      select tm.user_id, v_fixture.tournament_id, auth.uid(), 'champion_declared',
        case when v_previous_winner is null then 'Champion crowned' else 'Final winner updated' end,
        'The tournament final has a confirmed winner.', 'fixture', p_fixture_id
      from public.tournament_members tm where tm.tournament_id = v_fixture.tournament_id and tm.user_id <> auth.uid();
    elsif v_previous_winner is not null and v_new_winner is null then
      insert into public.activity_events (tournament_id, actor_id, event_type, entity_type, entity_id, metadata)
      values (v_fixture.tournament_id, auth.uid(), 'champion_retracted', 'fixture', p_fixture_id,
        jsonb_build_object('previous_winner_team_id', v_previous_winner));
      insert into public.notifications (recipient_id, tournament_id, actor_id, event_type, title, body, entity_type, entity_id)
      select tm.user_id, v_fixture.tournament_id, auth.uid(), 'champion_retracted', 'Champion status unresolved',
        'The final no longer has a confirmed winner.', 'fixture', p_fixture_id
      from public.tournament_members tm where tm.tournament_id = v_fixture.tournament_id and tm.user_id <> auth.uid();
    end if;
  end if;
  return v_fixture;
end;
$$;

create function public.schedule_fixture(p_fixture_id uuid, p_expected_version integer, p_scheduled_at timestamptz)
returns public.fixtures language plpgsql security definer set search_path = '' as $$
declare v_fixture public.fixtures%rowtype; v_event text;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found.' using errcode = 'P0002'; end if;
  if auth.uid() is null or not public.is_tournament_owner(v_fixture.tournament_id) then raise exception 'Only the owner can schedule matches.' using errcode = '42501'; end if;
  if v_fixture.version <> p_expected_version then raise exception 'Fixture changed elsewhere; refresh before scheduling.' using errcode = '40001'; end if;
  if v_fixture.status <> 'pending' then raise exception 'Played matches cannot be rescheduled.' using errcode = '22023'; end if;
  if v_fixture.scheduled_at is not distinct from p_scheduled_at then return v_fixture; end if;
  v_event := case when v_fixture.scheduled_at is null and p_scheduled_at is not null then 'match_scheduled'
    when v_fixture.scheduled_at is distinct from p_scheduled_at then 'match_rescheduled' else 'match_schedule_cleared' end;
  update public.fixtures set scheduled_at = p_scheduled_at, version = version + 1, updated_at = now()
  where id = p_fixture_id returning * into v_fixture;
  insert into public.activity_events (tournament_id, actor_id, event_type, entity_type, entity_id, metadata)
  values (v_fixture.tournament_id, auth.uid(), v_event, 'fixture', p_fixture_id, jsonb_build_object('scheduled_at', p_scheduled_at));
  insert into public.notifications (recipient_id, tournament_id, actor_id, event_type, title, body, entity_type, entity_id)
  select tm.user_id, v_fixture.tournament_id, auth.uid(), v_event,
    case when p_scheduled_at is null then 'Match time cleared' else 'Match time updated' end,
    case when p_scheduled_at is null then 'A fixture no longer has a scheduled kickoff.' else 'A fixture kickoff time has been set or changed.' end,
    'fixture', p_fixture_id
  from public.tournament_members tm where tm.tournament_id = v_fixture.tournament_id and tm.user_id <> auth.uid();
  return v_fixture;
end;
$$;

create function public.create_tournament_final(p_tournament_id uuid)
returns public.fixtures language plpgsql security definer set search_path = '' as $$
declare v_teams uuid[]; v_fixture public.fixtures%rowtype;
begin
  if auth.uid() is null or not public.is_tournament_owner(p_tournament_id) then raise exception 'Only the owner can create the final.' using errcode = '42501'; end if;
  if not exists (select 1 from public.fixtures where tournament_id = p_tournament_id and stage = 'league') then raise exception 'Generate the league schedule first.' using errcode = '22023'; end if;
  if exists (select 1 from public.fixtures where tournament_id = p_tournament_id and stage = 'league' and status <> 'played') then raise exception 'Every league match must be played first.' using errcode = '22023'; end if;
  if exists (select 1 from public.fixtures where tournament_id = p_tournament_id and stage = 'final') then raise exception 'A final already exists.' using errcode = '22023'; end if;
  with table_rows as (
    select tt.team_id, t.name,
      coalesce(sum(case when f.home_team_id = tt.team_id then case when f.home_score > f.away_score then 3 when f.home_score = f.away_score then 1 else 0 end else case when f.away_score > f.home_score then 3 when f.away_score = f.home_score then 1 else 0 end end), 0) points,
      coalesce(sum(case when f.home_team_id = tt.team_id then f.home_score - f.away_score else f.away_score - f.home_score end), 0) gd,
      coalesce(sum(case when f.home_team_id = tt.team_id then f.home_score else f.away_score end), 0) gf
    from public.tournament_teams tt join public.teams t on t.id = tt.team_id
    left join public.fixtures f on f.tournament_id = p_tournament_id and f.stage = 'league' and f.status = 'played'
      and tt.team_id in (f.home_team_id, f.away_team_id)
    where tt.tournament_id = p_tournament_id group by tt.team_id, t.name
  )
  select array_agg(team_id order by points desc, gd desc, gf desc, lower(name) collate "C", team_id) into v_teams from table_rows;
  if coalesce(array_length(v_teams, 1), 0) < 2 then raise exception 'At least two teams are required for the final.' using errcode = '22023'; end if;
  insert into public.fixtures (tournament_id, home_team_id, away_team_id, stage, status)
  values (p_tournament_id, v_teams[1], v_teams[2], 'final', 'pending') returning * into v_fixture;
  insert into public.activity_events (tournament_id, actor_id, event_type, entity_type, entity_id) values (p_tournament_id, auth.uid(), 'final_created', 'fixture', v_fixture.id);
  insert into public.notifications (recipient_id, tournament_id, actor_id, event_type, title, body, entity_type, entity_id)
  select tm.user_id, p_tournament_id, auth.uid(), 'final_created', 'The final is set', 'The league is complete and the final fixture is ready.', 'fixture', v_fixture.id
  from public.tournament_members tm where tm.tournament_id = p_tournament_id and tm.user_id <> auth.uid();
  return v_fixture;
end;
$$;
create function public.mark_notifications_read(p_notification_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.notifications set read_at = now() where recipient_id = auth.uid() and read_at is null and (p_notification_id is null or id = p_notification_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.is_tournament_member(uuid) from public, anon;
revoke all on function public.is_tournament_owner(uuid) from public, anon;
revoke all on function public.create_team(text, text) from public, anon;
revoke all on function public.create_tournament_with_teams(text, text, date, date, text, uuid[]) from public, anon;
revoke all on function public.create_tournament_invite(uuid, timestamptz) from public, anon;
revoke all on function public.accept_tournament_invite(text) from public, anon;
revoke all on function public.revoke_tournament_invite(uuid) from public, anon;
revoke all on function public.revoke_tournament_member(uuid, uuid) from public, anon;
revoke all on function public.generate_league_fixtures(uuid, jsonb) from public, anon;
revoke all on function public.save_fixture_result(uuid, integer, text, integer, integer, jsonb, text) from public, anon;
revoke all on function public.schedule_fixture(uuid, integer, timestamptz) from public, anon;
revoke all on function public.create_tournament_final(uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid) from public, anon;
grant execute on function public.is_tournament_member(uuid) to authenticated;
grant execute on function public.is_tournament_owner(uuid) to authenticated;
grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.create_tournament_with_teams(text, text, date, date, text, uuid[]) to authenticated;
grant execute on function public.create_tournament_invite(uuid, timestamptz) to authenticated;
grant execute on function public.accept_tournament_invite(text) to authenticated;
grant execute on function public.revoke_tournament_invite(uuid) to authenticated;
grant execute on function public.revoke_tournament_member(uuid, uuid) to authenticated;
grant execute on function public.generate_league_fixtures(uuid, jsonb) to authenticated;
grant execute on function public.save_fixture_result(uuid, integer, text, integer, integer, jsonb, text) to authenticated;
grant execute on function public.schedule_fixture(uuid, integer, timestamptz) to authenticated;
grant execute on function public.create_tournament_final(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
       ('tournament-logos', 'tournament-logos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
create policy team_logo_read_authorized on storage.objects for select to authenticated using (
  bucket_id = 'team-logos' and exists (
    select 1 from public.teams team
    where team.logo_path = storage.objects.name and (
      team.owner_id = auth.uid()
      or exists (select 1 from public.tournament_teams tt
        where tt.team_id = team.id and public.is_tournament_member(tt.tournament_id))
    )
  )
);
create policy tournament_logo_read_member on storage.objects for select to authenticated using (
  bucket_id = 'tournament-logos' and exists (
    select 1 from public.tournaments tournament
    where tournament.logo_path = storage.objects.name and public.is_tournament_member(tournament.id)
  )
);
create policy logo_upload_own_folder on storage.objects for insert to authenticated with check (
  bucket_id in ('team-logos', 'tournament-logos') and (storage.foldername(name))[1] = auth.uid()::text
);
create policy logo_update_own_folder on storage.objects for update to authenticated using (
  bucket_id in ('team-logos', 'tournament-logos') and (storage.foldername(name))[1] = auth.uid()::text
) with check (bucket_id in ('team-logos', 'tournament-logos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy logo_delete_own_folder on storage.objects for delete to authenticated using (
  bucket_id in ('team-logos', 'tournament-logos') and (storage.foldername(name))[1] = auth.uid()::text
);
