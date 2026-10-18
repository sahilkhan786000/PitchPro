# Security

## Trust Boundaries

The mobile app is an untrusted client. Supabase Auth identifies the actor; PostgreSQL derives ownership from `auth.uid()` and enforces access with RLS. The client never decides a tournament owner, member role, final champion, or completed status.

## Authorization Matrix

| Resource/action                                 | Owner                | Read-only member | Unrelated user |
| ----------------------------------------------- | -------------------- | ---------------- | -------------- |
| Read tournament, fixtures, activity             | Yes                  | Yes              | No             |
| Read participating teams/members                | Yes                  | Yes              | No             |
| Edit tournament or participants                 | Yes, before fixtures | No               | No             |
| Generate fixtures / save results / create final | Yes                  | No               | No             |
| Read own notifications/preferences/devices      | Yes                  | Yes              | Own rows only  |
| Create/revoke invitations or remove members     | Yes                  | No               | No             |
| Edit global team details                        | Team owner only      | No               | No             |

UI hiding is not authorization. Direct table mutations for fixture/result/final data have no authenticated write policies; trusted RPCs perform those changes.

## RLS and RPC Practices

- RLS is enabled on every user-facing application table.
- Every security-definer function sets an empty `search_path`, checks authenticated identity and ownership, and has execute grants restricted to `authenticated`.
- Invitation tokens are 256-bit random values. Only SHA-256 hashes are stored; the invitation is one-use and expires within 30 days.
- Score saves use row locking and `version` checks to prevent silent concurrent overwrite.
- Profiles and tournament data are readable only by the user or current tournament members.
- Notifications are recipient-scoped; push preferences default off.

## Secrets and Storage

- The mobile client may contain only the Supabase URL and public anon/publishable key.
- Never set `SUPABASE_SERVICE_ROLE_KEY` as an `EXPO_PUBLIC_*` variable or commit it.
- The service-role key is used only by the Supabase Edge Function and stored as an Edge Function secret.
- Private logo buckets permit authenticated reads and uploads only under the current user's folder. Uploads are limited to PNG/JPEG/WebP and 5 MB by Storage; both the team write policies and `create_team` RPC require the saved logo path to remain in the owner's folder.
- Local `.env` files are ignored by git; `.env.example` contains placeholders only.

## Push Delivery

The Database Webhook authenticates to the Edge Function with the service-role bearer token configured only in Supabase. The function accepts either that trusted webhook event or a valid user JWT; user-triggered dispatch is restricted to notifications authored by that user. Recipient IDs and device tokens are derived from the database. Expo push credentials never ship in the app. Delivery failures are recorded and `DeviceNotRegistered` tokens are removed.

## Operational Checklist

- Enable email confirmation and configure the exact `pitchpro://` redirect URLs in Supabase Auth.
- Review RLS policies whenever adding a table or RPC.
- Keep EAS, Supabase, Firebase, and Apple credentials in their respective secret stores.
- Rotate a leaked key immediately and revoke affected invitation links.
- Back up the Supabase project and test restoring migrations/data before production use.
- Review privacy disclosures for account email/name, uploaded team logos, device push tokens, and notification data before store submission.
