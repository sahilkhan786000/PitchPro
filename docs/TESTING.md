# Testing

## Local Checks

```powershell
npm test
npm run typecheck
npx expo-doctor
npx expo config --type public
```

`npm test` runs Vitest business-logic tests. Coverage includes 2/3/4/5/6/10-team round robins, deterministic schedules, home/away orientation, per-matchday occupancy, 12-match four-team format, standings and recent form, pending/final exclusion, corrected/reverted results, final eligibility, duplicate prevention, and drawn/winning finals.

`npm run typecheck` checks the Expo app. Supabase Edge Functions use Deno and are intentionally excluded from the mobile `tsconfig`; with Deno installed, run:

```powershell
deno check supabase/functions/send-tournament-push/index.ts
```

## Backend Verification

After Docker and the Supabase CLI are available:

```powershell
npx supabase start
npx supabase db reset
npx supabase db lint --local
```

Add integration tests against the local stack for signup/profile trigger, team and tournament RPCs, fixture generation idempotency, result version conflicts, member invitation expiry/revocation, RLS denial of direct mutations, rejection of a team `logo_path` outside the authenticated owner's storage folder, private match-note photo access (member read, owner upload/delete), final lifecycle, and push webhook behavior. RLS must be tested with authenticated owner, read-only member, and unrelated user JWTs; service-role tests alone do not validate RLS.

The initial environment did not include Supabase credentials or a configured local database, so migrations, RLS integration tests, file uploads, realtime delivery, Edge Function delivery, and Auth flows cannot be reported as executed. Do not treat TypeScript/unit-test success as backend verification.

## Manual Device Matrix

- iPhone small/large and Android small/large viewport; verify safe area, auth-field visibility with the keyboard open, horizontal tournament filters, section swipes, match-note photo upload/display, table team crests, modals, and dark contrast.
- Expo Go for non-push flows; development build for remote push and native permissions.
- Owner and read-only member accounts; verify direct table requests are denied for the member.
- Correct result, revert to pending, drawn final, changed final winner, reconnect, and reopen completed tournament.
- Reduce Motion enabled; celebration should skip animation and remain fully navigable.
