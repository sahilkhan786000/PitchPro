# Database

## Migration

The migration history has been replaced with a clean Club-scoped baseline:

- `supabase/migrations/202610210001_club_hierarchy_baseline.sql` creates the application schema.
- `supabase/migrations/202610210002_club_scoped_access.sql` enforces Club-first data access.
- `supabase/migrations/202610210003_club_scoped_notifications.sql` scopes notification reads and read-state changes to the active Club.
- `supabase/migrations/202610220001_match_note_images.sql` adds private fixture photo notes and owner-authorized image uploads.

Because the previous migration files were removed, an already-migrated test database must be reset before applying this baseline. `npx supabase db reset --linked` is destructive: it drops the linked database's application data and rebuilds it from the current migrations. Use it only for the disposable test project. Do not reset a production project.

## Tables

- `profiles`: auth-linked display names and avatars; created from the Auth user trigger.
- `teams`: Club-scoped, creator-owned records and private logo paths; Club members can view them, while creators manage/delete their own teams. Deletion is restricted when referenced by tournament participation or fixtures.
- `tournaments`: Club-scoped, owner-managed records with dates, timezone, status, and supported competition format.
- `tournament_members`: owner/read-only roles; the owner membership is inserted automatically.
- `tournament_teams`: unique tournament/team participants, frozen after fixture creation.
- `matchdays`: unique numbered rounds per tournament.
- `fixtures`: league/final stage, pending/played status, scores, schedule, text/photo notes, optimistic version, and stable `played_at`.
- `goal_events`: scorer, team, minute, and goal type, replaced atomically with a result save.
- `activity_events`: durable tournament audit timeline; secrets are not included.
- `notifications`: recipient-specific in-app events with read timestamps.
- `tournament_invitations`: one-use SHA-256 token hashes, expiry, acceptance, and revocation.
- `notification_preferences`, `push_devices`, `push_deliveries`: opt-in settings, per-device Expo tokens, and idempotent server-side delivery records.

Club membership is the first authorization boundary: records from another Club are not visible, including to administrators who are not members of that Club. Within a Club, its members can view Club tournaments and teams; creators retain owner-only management actions. Teams can only be added to tournaments in their own Club. Tournament invitations do not grant access across Club boundaries. Notifications and notification read-state changes are also scoped to the active Club.

Foreign keys and unique indexes preserve historical fixture references. Team deletion is restricted when history references that team. Tournament deletion cascades its tournament-owned rows.

## Competition Rules

For $N$ teams the client generator creates $N(N-1)$ league fixtures. Even team counts use $2(N-1)$ matchdays; odd team counts use $2N$ matchdays and a bye. Every pairing is checked for one home and one away appearance; no team may appear twice on a matchday. The database RPC validates participant membership, count, pair orientations, round counts, and matchday occupancy before inserting anything.

Standings include only played `league` fixtures. Ranking order is points, goal difference, goals for, case-insensitive deterministic team name, then team ID. Finals never affect league statistics. A valid final winner is derived only from a played, non-drawn final.

## Trusted RPCs

- `create_team`: requires Club membership, assigns `owner_id` from `auth.uid()`, and validates logo path ownership.
- `create_tournament_with_teams`: atomically creates tournament, owner membership, participants, and activity.
- `generate_league_fixtures`: validates and atomically persists matchdays/fixtures; rejects regeneration.
- `save_fixture_result_with_image`: saves a fixture result and text/photo notes atomically, while the underlying result RPC checks expected version and owner role, validates scores/goals, writes activity and notification rows, and updates tournament lifecycle for finals.
- `create_tournament_final`: checks league completion, ranks standings server-side, and creates the unique final.
- `create_tournament_invite` / `accept_tournament_invite` / `revoke_tournament_invite`: hash one-use tokens and enforce expiry/revocation.
- `revoke_tournament_member`: lets only the owner remove read-only members.
- `mark_notifications_read`: changes read state only for the authenticated recipient.

## Realtime and Storage

The migration publishes fixtures, activity events, and notifications to `supabase_realtime`. Fixture replica identity is `FULL` so update events include data needed by filters. Team and tournament logos and match-note photos use private Storage buckets with 5 MB limits and authenticated owner policies. Tournament members can read attached match photos through expiring signed URLs; only tournament owners can upload or delete them.

## Local Development

For a local Supabase stack, install Docker Desktop and the Supabase CLI, then run `npx supabase start`, `npx supabase db reset`, and `npx supabase status`. Local containers and migrations have not been verified in this environment; use `npx supabase db lint --local` and integration tests once Docker is available.
