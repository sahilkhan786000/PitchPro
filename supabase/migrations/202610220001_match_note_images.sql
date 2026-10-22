begin;

alter table public.fixtures
  add column notes_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-notes',
  'match-notes',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy match_note_image_read_member on storage.objects
for select to authenticated
using (
  bucket_id = 'match-notes'
  and exists (
    select 1
    from public.fixtures fixture
    where fixture.notes_image_path = storage.objects.name
      and public.is_tournament_member(fixture.tournament_id)
  )
);

create policy match_note_image_insert_owner on storage.objects
for insert to authenticated
with check (
  bucket_id = 'match-notes'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.fixtures fixture
    where fixture.id::text = split_part(name, '/', 2)
      and public.is_tournament_owner(fixture.tournament_id)
  )
);

create policy match_note_image_delete_owner on storage.objects
for delete to authenticated
using (
  bucket_id = 'match-notes'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.fixtures fixture
    where fixture.id::text = split_part(name, '/', 2)
      and public.is_tournament_owner(fixture.tournament_id)
  )
);

create function public.save_fixture_result_with_image(
  p_fixture_id uuid,
  p_expected_version integer,
  p_status text,
  p_home_score integer,
  p_away_score integer,
  p_goal_events jsonb,
  p_notes text,
  p_notes_image_path text
)
returns public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
begin
  if p_notes_image_path is not null and (
    split_part(p_notes_image_path, '/', 1) <> auth.uid()::text
    or split_part(p_notes_image_path, '/', 2) <> p_fixture_id::text
    or not exists (
      select 1
      from storage.objects image
      where image.bucket_id = 'match-notes'
        and image.name = p_notes_image_path
    )
  ) then
    raise exception 'Match photo is invalid or unavailable.' using errcode = '22023';
  end if;

  v_fixture := public.save_fixture_result(
    p_fixture_id,
    p_expected_version,
    p_status,
    p_home_score,
    p_away_score,
    p_goal_events,
    p_notes
  );

  update public.fixtures
  set notes_image_path = p_notes_image_path,
      updated_at = now()
  where id = p_fixture_id
    and public.is_tournament_owner(tournament_id)
  returning * into v_fixture;

  return v_fixture;
end;
$$;

revoke all on function public.save_fixture_result_with_image(
  uuid, integer, text, integer, integer, jsonb, text, text
) from public, anon;
grant execute on function public.save_fixture_result_with_image(
  uuid, integer, text, integer, integer, jsonb, text, text
) to authenticated;

commit;
