# Deployment

## Supabase

1. Create a Supabase project and configure email/password Auth.
2. Add `pitchpro://**` (and the relevant local development callback URLs) to Auth's allowed redirect URLs.
3. Add the project URL and public anon/publishable key to local `.env` as `EXPO_PUBLIC_SUPABASE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Install the Supabase CLI, sign in with `npx supabase login`, link with `npx supabase link --project-ref <project-ref>`, then apply the migration with `npx supabase db push`.
5. Confirm the `team-logos` and `tournament-logos` private buckets exist. The migration creates them and their policies.
6. Confirm the `fixtures`, `activity_events`, and `notifications` tables are in `supabase_realtime`.
7. Set up backups and point-in-time recovery according to the selected Supabase plan.

## Edge Function and Database Webhook

Set function secrets from a secure terminal (do not commit values):

```powershell
npx supabase secrets set SUPABASE_URL="<project-url>" SUPABASE_ANON_KEY="<public-anon-key>" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
npx supabase functions deploy send-tournament-push
```

In Supabase Dashboard, create a Database Webhook for `public.notifications`, `INSERT` only, targeting the deployed `send-tournament-push` function. Configure the request as POST JSON with `Authorization: Bearer <service-role-key>` as a webhook-only server-side header. The function accepts only notification insert payloads for this trusted credential. Keep the header out of mobile/EAS public variables. Verify it by creating a test notification for a user with a registered push device; inspect `push_deliveries` and function logs.

## EAS and Native IDs

1. Create or select an EAS project and run `npx eas-cli init`.
2. Copy the generated EAS project UUID to `EXPO_PUBLIC_EAS_PROJECT_ID` in local `.env` and to the EAS `production` environment.
3. Set `PITCHPRO_ANDROID_PACKAGE` and `PITCHPRO_IOS_BUNDLE_ID` to identifiers you own. The app intentionally does not claim third-party identifiers.
4. Add `EXPO_PUBLIC_SUPABASE_URL`, either `EXPO_PUBLIC_SUPABASE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID`, `PITCHPRO_ANDROID_PACKAGE`, and `PITCHPRO_IOS_BUNDLE_ID` to EAS environments used for builds. These Supabase client values are public configuration, not service-role credentials.
5. Keep EAS credentials remote unless your organization requires local signing material.

`eas.json` provides development, preview, and production profiles:

```powershell
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile preview --platform ios
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```

The production Android output is an `.aab`. iOS store builds require Apple Developer membership, provisioning, and EAS signing credentials. No build has been claimed or completed in this setup.

## Push Credentials

- Android: configure an FCM v1 service account in EAS credentials for the Android application.
- iOS: configure an APNs key in EAS credentials under an Apple Developer team. A paid Apple Developer account is required for device distribution.
- Install a development build before testing remote notifications. Expo Go is insufficient for Android remote push.
- Register test devices using Profile > Push updates, then test with Expo's notification tooling and the Supabase webhook.

## Store Readiness Checklist

- App icon, splash screen, screenshots for current devices, and store metadata.
- Unique Android application ID and iOS bundle ID, owned by the publisher.
- Google Play Console account and signing; Apple Developer Program and App Store Connect.
- Privacy policy URL authored and hosted by the publisher. Do not invent or reuse an unrelated URL.
- Disclose account email/name, team logo uploads, push token use, and tournament activity notifications.
- Test account lifecycle, data deletion, support contact, age rating, and review credentials.
- Validate tablet/phone layouts, accessibility, deep links, offline/error behavior, and notification permissions.
- Submit Android internal testing first; use TestFlight for iOS before production review.

Store approval, signing, and distribution require the publisher's credentials and have not been performed here.
