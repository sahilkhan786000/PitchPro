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

1. The Android application ID is `com.azal.pitchpro`. Confirm it is available in Google Play Console before the first upload; it becomes permanent once published.
2. Sign in to EAS with `npx eas-cli login`, then run `npx eas-cli init` to create or select the EAS project and link its project UUID to this app.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and either `EXPO_PUBLIC_SUPABASE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the EAS environment used for production builds. These Supabase client values are public configuration, not service-role credentials. The Android package ID is set in `app.json`; do not change it after publishing.
4. Set `PITCHPRO_IOS_BUNDLE_ID` only if preparing an iOS release. Keep EAS signing credentials remote unless your organization requires local signing material.

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

## Android Google Play Release

1. Enroll in a Google Play Developer account and create the PitchPro app in [Play Console](https://play.google.com/console/). The Play app's package name must be `com.azal.pitchpro`.
2. Complete the Google Play API access setup, create a service account with access to this app, and upload its JSON key to the linked EAS project under **Credentials → Android → Google service account key for EAS Submit**. Never commit the key or put it in app environment variables.
3. Configure the production Supabase URL and public client key in EAS. Verify the production backend, Auth redirect URLs, database migrations, storage buckets, and policies before release.
4. Build the Android App Bundle:

   ```powershell
   npm run build:android
   ```

5. Submit the finished build to internal testing:

   ```powershell
   npx eas-cli submit --platform android --profile production --latest
   ```

   The production submit profile deliberately targets the **internal** testing track first. Install and exercise the Play testing build on real devices before proceeding.
6. Complete the Play listing and required app-content declarations (including privacy policy, data safety, account deletion, and review access where applicable), then create and submit a production release in Play Console. Google review and any account-specific testing requirements must be completed before general availability.

An EAS upload does not itself make the app publicly available. The app becomes installable by all Play Store users only after its production release is approved and rolled out in Play Console.

## Push Credentials

- Android: configure an FCM v1 service account in EAS credentials for the Android application.
- iOS: configure an APNs key in EAS credentials under an Apple Developer team. A paid Apple Developer account is required for device distribution.
- Install a development build before testing remote notifications. Expo Go is insufficient for Android remote push.
- The app no longer provides device registration or push opt-in; any legacy device tokens must be managed outside the app.

## Store Readiness Checklist

- App icon, splash screen, screenshots for current devices, and store metadata.
- Unique Android application ID and iOS bundle ID, owned by the publisher.
- Google Play Console account and signing; Apple Developer Program and App Store Connect.
- Privacy policy URL authored and hosted by the publisher. Do not invent or reuse an unrelated URL.
- Disclose account email/name, team logo uploads, and tournament activity data.
- Test account lifecycle, data deletion, support contact, age rating, and review credentials.
- Validate tablet/phone layouts, accessibility, deep links, and offline/error behavior.
- Submit Android internal testing first; use TestFlight for iOS before production review.

Store approval, signing, and distribution require the publisher's credentials and have not been performed here.
