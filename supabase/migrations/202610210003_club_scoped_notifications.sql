begin;

drop function if exists public.create_team(text, text);

drop function public.mark_notifications_read(uuid);
create function public.mark_notifications_read(
  p_club_id uuid,
  p_notification_id uuid default null
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if not public.is_club_member(p_club_id) then
    raise exception 'Join this Club to update its notifications.' using errcode = '42501';
  end if;

  update public.notifications n
  set read_at = now()
  from public.tournaments t
  where n.tournament_id = t.id
    and t.club_id = p_club_id
    and n.recipient_id = auth.uid()
    and n.read_at is null
    and (p_notification_id is null or n.id = p_notification_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notifications_read(uuid, uuid) from public, anon;
grant execute on function public.mark_notifications_read(uuid, uuid) to authenticated;

commit;
