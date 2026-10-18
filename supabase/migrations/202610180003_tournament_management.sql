create function public.delete_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_tournament_owner(p_tournament_id) then
    raise exception 'Only the tournament creator can delete this tournament.' using errcode = '42501';
  end if;

  delete from public.fixtures where tournament_id = p_tournament_id;
  delete from public.matchdays where tournament_id = p_tournament_id;
  delete from public.tournaments where id = p_tournament_id;
end;
$$;

create function public.remove_tournament_team(
  p_tournament_id uuid,
  p_team_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_tournament_owner(p_tournament_id) then
    raise exception 'Only the tournament creator can remove teams.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tournament_teams
    where tournament_id = p_tournament_id and team_id = p_team_id
  ) then
    raise exception 'Team is not part of this tournament.' using errcode = '22023';
  end if;

  delete from public.notifications n
  using public.fixtures f
  where f.tournament_id = p_tournament_id
    and (f.home_team_id = p_team_id or f.away_team_id = p_team_id)
    and n.tournament_id = p_tournament_id
    and n.entity_type = 'fixture'
    and n.entity_id = f.id;
  delete from public.fixtures
  where tournament_id = p_tournament_id
    and (home_team_id = p_team_id or away_team_id = p_team_id);
  delete from public.tournament_teams
  where tournament_id = p_tournament_id and team_id = p_team_id;
  delete from public.matchdays md
  where md.tournament_id = p_tournament_id
    and not exists (select 1 from public.fixtures f where f.matchday_id = md.id);
  update public.tournaments
  set status = 'active'
  where id = p_tournament_id
    and not exists (
      select 1 from public.fixtures
      where tournament_id = p_tournament_id and stage = 'final'
    );
  insert into public.activity_events (tournament_id, actor_id, event_type, metadata)
  values (
    p_tournament_id,
    auth.uid(),
    'team_removed',
    jsonb_build_object('team_id', p_team_id)
  );
end;
$$;

create function public.delete_tournament_fixture(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_fixture public.fixtures%rowtype;
begin
  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id
  for update;
  if not found then
    raise exception 'Fixture not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_tournament_owner(v_fixture.tournament_id) then
    raise exception 'Only the tournament creator can delete fixtures.' using errcode = '42501';
  end if;

  delete from public.notifications
  where tournament_id = v_fixture.tournament_id
    and entity_type = 'fixture'
    and entity_id = p_fixture_id;
  delete from public.fixtures where id = p_fixture_id;
  if v_fixture.matchday_id is not null then
    delete from public.matchdays md
    where md.id = v_fixture.matchday_id
      and not exists (select 1 from public.fixtures f where f.matchday_id = md.id);
  end if;
  if v_fixture.stage = 'final' then
    update public.tournaments set status = 'active' where id = v_fixture.tournament_id;
  end if;
  insert into public.activity_events (tournament_id, actor_id, event_type, entity_type, entity_id)
  values (
    v_fixture.tournament_id,
    auth.uid(),
    'fixture_deleted',
    'fixture',
    p_fixture_id
  );
end;
$$;

revoke all on function public.delete_tournament(uuid) from public, anon;
revoke all on function public.remove_tournament_team(uuid, uuid) from public, anon;
revoke all on function public.delete_tournament_fixture(uuid) from public, anon;
grant execute on function public.delete_tournament(uuid) to authenticated;
grant execute on function public.remove_tournament_team(uuid, uuid) to authenticated;
grant execute on function public.delete_tournament_fixture(uuid) to authenticated;

notify pgrst, 'reload schema';
