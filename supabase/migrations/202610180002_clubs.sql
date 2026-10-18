begin;

alter table public.fanclubs rename to clubs;
alter table public.fanclub_members rename to club_members;
alter table public.fanclub_join_attempts rename to club_join_attempts;
alter table public.club_members rename column fanclub_id to club_id;
alter table public.tournaments rename column fanclub_id to club_id;

alter index public.fanclubs_name_ci_unique rename to clubs_name_ci_unique;
alter index public.fanclub_members_user_idx rename to club_members_user_idx;
alter index public.tournaments_fanclub_created_idx rename to tournaments_club_created_idx;

alter table public.clubs rename constraint fanclubs_pkey to clubs_pkey;
alter table public.clubs rename constraint fanclubs_owner_id_fkey to clubs_owner_id_fkey;
alter table public.club_members rename constraint fanclub_members_pkey to club_members_pkey;
alter table public.club_members rename constraint fanclub_members_fanclub_id_fkey to club_members_club_id_fkey;
alter table public.club_members rename constraint fanclub_members_user_id_fkey to club_members_user_id_fkey;
alter table public.club_members rename constraint fanclub_members_fanclub_id_user_id_key to club_members_club_id_user_id_key;
alter table public.club_join_attempts rename constraint fanclub_join_attempts_pkey to club_join_attempts_pkey;
alter table public.club_join_attempts rename constraint fanclub_join_attempts_user_id_fkey to club_join_attempts_user_id_fkey;
alter table public.tournaments rename constraint tournaments_fanclub_id_fkey to tournaments_club_id_fkey;

 drop policy fanclub_members_read_self on public.club_members;
drop policy tournaments_insert_fanclub_owner on public.tournaments;
drop policy tournaments_update_owner on public.tournaments;
drop trigger tournament_fanclub_guard on public.tournaments;
drop function public.protect_tournament_fanclub();
drop function public.create_tournament_with_teams(uuid, text, text, date, date, text, uuid[]);
drop function public.create_fanclub(text, text);
drop function public.join_fanclub(text, text);
drop function public.is_fanclub_member(uuid);

create function public.is_club_member(p_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_tournament_member(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournament_members tm
    where tm.tournament_id = p_tournament_id and tm.user_id = auth.uid()
  ) or exists (
    select 1
    from public.tournaments t
    join public.club_members cm on cm.club_id = t.club_id
    where t.id = p_tournament_id and cm.user_id = auth.uid()
  );
$$;

create function public.protect_tournament_club()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.club_id is null or not public.is_club_member(new.club_id) then
      raise exception 'A tournament must belong to one of your Clubs.' using errcode = '42501';
    end if;
  elsif current_user = 'authenticated' and new.club_id is distinct from old.club_id then
    raise exception 'Tournament Club cannot be changed directly.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tournament_club_guard
before insert or update on public.tournaments
for each row execute function public.protect_tournament_club();

create policy club_members_read_self on public.club_members
for select to authenticated using (user_id = auth.uid());

create policy tournaments_insert_club_owner on public.tournaments
for insert to authenticated
with check (
  owner_id = auth.uid()
  and club_id is not null
  and public.is_club_member(club_id)
);

create policy tournaments_update_owner on public.tournaments
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and club_id is not null
  and public.is_club_member(club_id)
);

create function public.create_tournament_with_teams(
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
  v_timezone text;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  if not public.is_club_member(p_club_id) then raise exception 'Join a Club before creating a tournament.' using errcode = '42501'; end if;
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
  insert into public.tournaments (owner_id, club_id, name, description, start_date, end_date, timezone)
  values (auth.uid(), p_club_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_start_date, p_end_date, v_timezone)
  returning id into v_tournament_id;
  insert into public.tournament_teams (tournament_id, team_id, seed)
  select v_tournament_id, team_id, ordinality::integer
  from unnest(p_team_ids) with ordinality as selected(team_id, ordinality);
  insert into public.activity_events (tournament_id, actor_id, event_type, metadata)
  values (v_tournament_id, auth.uid(), 'tournament_created', jsonb_build_object('team_count', v_team_count));
  return v_tournament_id;
end;
$$;

create function public.create_club(p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'Club name must be between 2 and 60 characters.' using errcode = '22023'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6}$' then raise exception 'PIN must be exactly six digits.' using errcode = '22023'; end if;
  insert into public.clubs (name, owner_id, pin_hash)
  values (v_name, auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 12)))
  returning id into v_club_id;
  insert into public.club_members (club_id, user_id, role)
  values (v_club_id, auth.uid(), 'owner');
  update public.tournaments set club_id = v_club_id
  where owner_id = auth.uid() and club_id is null;
  return jsonb_build_object('ok', true, 'id', v_club_id, 'name', v_name);
exception when unique_violation then
  raise exception 'A Club with that name already exists.' using errcode = '23505';
end;
$$;

create function public.join_club(p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_club public.clubs%rowtype;
  v_attempt_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  insert into public.club_join_attempts as attempts (user_id, attempt_count, window_started_at)
  values (auth.uid(), 1, now())
  on conflict (user_id) do update set
    attempt_count = case
      when attempts.window_started_at < now() - interval '15 minutes' then 1
      else attempts.attempt_count + 1
    end,
    window_started_at = case
      when attempts.window_started_at < now() - interval '15 minutes' then now()
      else attempts.window_started_at
    end
  returning attempts.attempt_count into v_attempt_count;
  if v_attempt_count > 5 then
    return jsonb_build_object('ok', false, 'message', 'Too many attempts. Try again in 15 minutes.');
  end if;
  if char_length(v_name) not between 2 and 60 or coalesce(p_pin, '') !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'message', 'Club name or PIN is incorrect.');
  end if;
  select * into v_club from public.clubs
  where lower(trim(name)) = lower(v_name);
  if not found or extensions.crypt(p_pin, v_club.pin_hash) <> v_club.pin_hash then
    return jsonb_build_object('ok', false, 'message', 'Club name or PIN is incorrect.');
  end if;
  insert into public.club_members (club_id, user_id, role)
  values (v_club.id, auth.uid(), 'member')
  on conflict (club_id, user_id) do nothing;
  update public.club_join_attempts set attempt_count = 0, window_started_at = now()
  where user_id = auth.uid();
  update public.tournaments set club_id = v_club.id
  where owner_id = auth.uid() and club_id is null;
  return jsonb_build_object('ok', true, 'id', v_club.id, 'name', v_club.name);
end;
$$;

revoke all on function public.is_club_member(uuid) from public, anon;
revoke all on function public.create_club(text, text) from public, anon;
revoke all on function public.join_club(text, text) from public, anon;
revoke all on function public.create_tournament_with_teams(uuid, text, text, date, date, text, uuid[]) from public, anon;
grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.create_club(text, text) to authenticated;
grant execute on function public.join_club(text, text) to authenticated;
grant execute on function public.create_tournament_with_teams(uuid, text, text, date, date, text, uuid[]) to authenticated;

commit;
