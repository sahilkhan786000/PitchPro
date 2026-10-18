drop policy if exists teams_insert_owner on public.teams;
create policy teams_insert_owner on public.teams
for insert to authenticated
with check (
  owner_id = auth.uid()
  and (
    logo_path is null
    or (storage.foldername(logo_path))[1] = auth.uid()::text
  )
);

drop policy if exists teams_update_owner on public.teams;
create policy teams_update_owner on public.teams
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and (
    logo_path is null
    or (storage.foldername(logo_path))[1] = auth.uid()::text
  )
);