# Architecture

## Runtime

- Expo SDK 58 / React Native 0.88 with strict TypeScript and Expo Router file-based navigation.
- TanStack Query owns server cache and invalidation; React state is limited to local UI such as filters, forms, and open modals.
- Supabase Auth restores sessions with Expo SecureStore on native and browser storage on web.
- Supabase Postgres is authoritative for ownership, memberships, tournament lifecycle, fixtures, results, goals, activity, and notifications.
- RLS controls row access. Security-definer RPCs implement multi-row operations atomically and derive acting users with `auth.uid()`.
- Supabase Realtime invalidates tournament and notification queries for authorized subscribers.
- EAS profiles describe development, preview, and production builds. App identifiers and project IDs are owner-configured.

## Code Ownership

- `app/`: Router screens for authentication, dashboard, teams, tournaments, invitations, and champion presentation.
- `src/features/fixtures/roundRobin.ts`: deterministic circle-method scheduling and dynamic format counts.
- `src/features/standings/calculateStandings.ts`: shared league-only table calculation.
- `src/features/finals/rules.ts`: final eligibility and winner resolution shared by screens and tests.
- `src/features/tournaments/api.ts`: typed query/RPC/Realtime boundary.
- `src/features/notifications/registerPushDevice.ts`: opt-in native push-token registration.
- `src/lib/auth.tsx`, `supabase.ts`, `queryClient.ts`: app-wide auth, backend, and query clients.
- `supabase/migrations/`: versioned schema, constraints, RLS, storage policies, and trusted RPCs.
- `supabase/functions/send-tournament-push/`: server-only Expo push dispatcher.

## Competition Data Flow

1. A user submits team/tournament forms; Zod validates user input.
2. Authenticated client calls an owner-checked RPC for atomic tournament setup or fixture generation.
3. Fixtures are read from Supabase; the app derives standings from played league fixtures only.
4. An owner submits a result with the current fixture version; the RPC locks and validates the fixture, replaces goal events, increments the version, records activity, and creates member notifications in one transaction.
5. Realtime invalidates tournament/activity queries. The database `played_at` timestamp remains stable across score corrections.
6. A final can be created only when all league fixtures are played. The database picks the top two and prevents a second final.
7. The persisted final determines the champion. A draw has no winner; a changed champion creates a new lifecycle event.

## Error and Offline Behavior

Mutations are server-confirmed before local success/navigation. Query errors have retry states; cached queries are read-only until refetched. Optimistic score updates are intentionally not used. Push delivery is separate from the transaction: notification rows persist even when an external push provider is unavailable.

## Deliberate Boundaries

The current MVP has no third-party service-role secret in the app, no hardcoded competition data, and no direct client insert/update policy for fixtures. App-store identifiers, Supabase project credentials, EAS identity, and mobile push credentials remain deployment inputs rather than invented values.
