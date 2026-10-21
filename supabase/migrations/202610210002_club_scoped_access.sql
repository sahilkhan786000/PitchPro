begin;

alter table public.teams
  add column club_id uuid not null references public.clubs(id) on delete cascade;

alter table public.teams
  drop constraint teams_owner_id_name_key,
  add constraint teams_club_id_name_key unique (club_id, name);

alter table public.teams alter column club_id set not null;
alter table public.tournaments alter column club_id set not null;

create index teams_club_name_idx on public.teams (club_id, name);

drop policy teams_read_authenticated on public.teams;
create policy teams_read_club_member on public.teams
for select to authenticated
using (public.is_club_member(club_id));

drop policy teams_insert_owner on public.teams;
create policy teams_insert_owner on public.teams
for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_club_member(club_id)
  and (
    logo_path is null
    or (storage.foldername(logo_path))[1] = auth.uid()::text
  )
);

drop policy teams_update_owner on public.teams;
create policy teams_update_owner on public.teams
for update to authenticated
using (owner_id = auth.uid() and public.is_club_member(club_id))
with check (
  owner_id = auth.uid()
  and public.is_club_member(club_id)
  and (
    logo_path is null
    or (storage.foldername(logo_path))[1] = auth.uid()::text
  )
);

create function public.protect_team_club()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.club_id is distinct from old.club_id then
    raise exception 'Team Club cannot be changed directly.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger team_club_guard
before update on public.teams
for each row execute function public.protect_team_club();

create or replace function public.is_tournament_member(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tournaments t
    join public.club_members cm on cm.club_id = t.club_id
    where t.id = p_tournament_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_tournament_owner(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tournaments t
    join public.club_members cm on cm.club_id = t.club_id
    where t.id = p_tournament_id
      and t.owner_id = auth.uid()
      and cm.user_id = auth.uid()
  );
$$;

drop policy tournament_teams_insert_owner on public.tournament_teams;
create policy tournament_teams_insert_owner on public.tournament_teams
for insert to authenticated
with check (
  public.is_tournament_owner(tournament_id)
  and not exists (
    select 1 from public.fixtures f
    where f.tournament_id = tournament_teams.tournament_id
  )
  and exists (
    select 1
    from public.tournaments t
    join public.teams team on team.club_id = t.club_id
    where t.id = tournament_teams.tournament_id
      and team.id = tournament_teams.team_id
  )
);

drop policy team_logo_read_authorized on storage.objects;
create policy team_logo_read_club_member on storage.objects
for select to authenticated
using (
  bucket_id = 'team-logos'
  and exists (
    select 1
    from public.teams team
    where team.logo_path = storage.objects.name
      and public.is_club_member(team.club_id)
  )
);

create function public.create_team(
  p_club_id uuid,
  p_name text,
  p_logo_path text default null
)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare
  v_team public.teams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if not public.is_club_member(p_club_id) then
    raise exception 'Join this Club before creating a team.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Team name must be between 1 and 60 characters.' using errcode = '22023';
  end if;
  if p_logo_path is not null
    and split_part(p_logo_path, '/', 1) <> auth.uid()::text then
    raise exception 'Logo path must belong to the authenticated user.' using errcode = '42501';
  end if;

  insert into public.teams (club_id, owner_id, name, logo_path)
  values (p_club_id, auth.uid(), trim(p_name), p_logo_path)
  returning * into v_team;
  return v_team;
end;
$$;

create or replace function public.create_tournament_with_teams(
  p_club_id uuid,
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_timezone text,
  p_team_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tournament_id uuid;
  v_team_count integer;
  v_unique_count integer;
  v_club_team_count integer;
  v_timezone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if not public.is_club_member(p_club_id) then
    raise exception 'Join a Club before creating a tournament.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 100 then
    raise exception 'Tournament name is required.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_team_ids, 1), 0) < 2 then
    raise exception 'Select at least two teams.' using errcode = '22023';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'End date must not be before start date.' using errcode = '22023';
  end if;
  v_timezone := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    raise exception 'Unknown time zone.' using errcode = '22023';
  end if;

  select count(*), count(distinct id), count(*) filter (where club_id = p_club_id)
  into v_team_count, v_unique_count, v_club_team_count
  from public.teams
  where id = any(p_team_ids);
  if v_team_count <> array_length(p_team_ids, 1)
    or v_unique_count <> v_team_count
    or v_club_team_count <> v_team_count then
    raise exception 'Every selected team must belong to this Club and be unique.' using errcode = '22023';
  end if;

  insert into public.tournaments (
    owner_id, club_id, name, description, start_date, end_date, timezone
  )
  values (
    auth.uid(), p_club_id, trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_start_date, p_end_date, v_timezone
  )
  returning id into v_tournament_id;

  insert into public.tournament_teams (tournament_id, team_id, seed)
  select v_tournament_id, team_id, ordinality::integer
  from unnest(p_team_ids) with ordinality as selected(team_id, ordinality);

  insert into public.activity_events (tournament_id, actor_id, event_type, metadata)
  values (
    v_tournament_id, auth.uid(), 'tournament_created',
    jsonb_build_object('team_count', v_team_count)
  );
  return v_tournament_id;
end;
$$;

create or replace function public.delete_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_tournament_name text;
begin
  select * into v_team
  from public.teams
  where id = p_team_id
  for update;

  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  if auth.uid() is null
    or not public.is_club_member(v_team.club_id)
    or v_team.owner_id <> auth.uid() then
    raise exception 'Only the team creator in this Club can delete this team.'
      using errcode = '42501';
  end if;

  select t.name into v_tournament_name
  from public.tournaments t
  where t.club_id = v_team.club_id
    and t.status in ('active', 'completed')
    and (
      exists (
        select 1 from public.tournament_teams tt
        where tt.tournament_id = t.id and tt.team_id = p_team_id
      )
      or exists (
        select 1 from public.fixtures f
        where f.tournament_id = t.id
          and (f.home_team_id = p_team_id or f.away_team_id = p_team_id)
      )
    )
  order by t.created_at desc
  limit 1;

  if v_tournament_name is not null then
    raise exception 'This team is being used by tournament "%".', v_tournament_name
      using errcode = '55000';
  end if;

  delete from public.teams where id = p_team_id;
end;
$$;

create or replace function public.accept_tournament_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.tournament_invitations%rowtype;
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  select * into v_invite
  from public.tournament_invitations
  where invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null
    and accepted_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'Invitation is invalid, expired, or already used.' using errcode = '22023';
  end if;

  select club_id into v_club_id
  from public.tournaments
  where id = v_invite.tournament_id;
  if not public.is_club_member(v_club_id) then
    raise exception 'Join this tournament’s Club before accepting its invitation.'
      using errcode = '42501';
  end if;

  insert into public.tournament_members (tournament_id, user_id, role)
  values (v_invite.tournament_id, auth.uid(), 'read_only')
  on conflict (tournament_id, user_id) do nothing;
  update public.tournament_invitations
  set accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;
  return v_invite.tournament_id;
end;
$$;

revoke all on function public.create_team(uuid, text, text) from public, anon;
grant execute on function public.create_team(uuid, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
