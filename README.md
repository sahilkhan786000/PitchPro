# PitchPro

PitchPro is a cross-platform football tournament manager built with Expo SDK 58, React Native, TypeScript, Expo Router, Supabase, and EAS. It includes authenticated tournament and team workflows, tested double round-robin and standings rules, owner-only result/final operations, read-only invitations, a tournament activity feed, and a persisted champion view.

## Current Status

The mobile application and Supabase schema are implemented, but they are not live until a Supabase project and EAS project are configured. No cloud credentials, store identities, or signing keys are included.

## Prerequisites

- Node.js 22.13 or newer (required by Expo SDK 58).
- npm.
- A Supabase project.
- For native development builds: EAS CLI account and device/simulator requirements.
- For store builds: your own Android application ID and Apple bundle identifier; Apple Developer credentials are required for signed iOS device builds.

## Install and Run

```powershell
npm install
Copy-Item .env.example .env
# Fill in the Supabase values in .env
npm run start
```

Open Expo Go for normal app development. Web can be started with `npm run web`.

## Environment

The mobile client uses only public Supabase values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY` (publishable key; `EXPO_PUBLIC_SUPABASE_ANON_KEY` is also accepted)
- `PITCHPRO_ANDROID_PACKAGE` (an identifier you own, for example `com.yourcompany.pitchpro`)
- `PITCHPRO_IOS_BUNDLE_ID` (an identifier you own)

Never put the Supabase service-role key in `.env`, app config, or the mobile bundle. It belongs only in Supabase Edge Function secrets. See [Deployment](docs/DEPLOYMENT.md).

## Supabase Setup

1. Create a Supabase project and copy its project URL and public anon/publishable key into `.env`.
2. Install the Supabase CLI and authenticate with `npx supabase login`.
3. Link this checkout using `npx supabase link --project-ref <your-project-ref>`.
4. This test schema starts from a clean Club-scoped baseline. For the disposable linked test project, run `npx supabase db reset --linked` to drop its existing database objects/data and apply the current migrations. Do not run this against a project whose data you need to keep.
5. Disable email confirmation in Supabase Auth so new accounts sign in immediately. Configure password-reset redirect URLs for `pitchpro://`.
6. Enable Realtime for `fixtures` and `activity_events` if the project did not apply the publication migration automatically.

The migration creates private logo buckets and their policies, all application tables, RPCs, RLS, and realtime publication entries. Details are in [Database](docs/DATABASE.md) and [Security](docs/SECURITY.md).

## Legacy Server-side Push Delivery

In-app notifications are persisted in Supabase and work independently of push credentials. To send remote push notifications:

1. Configure FCM v1 credentials for Android and APNs credentials for iOS in EAS.
2. Configure push devices through your own trusted administrative process. PitchPro no longer includes an in-app notification screen, device registration, or push opt-in.
3. Deploy the Edge Function: `npx supabase functions deploy send-tournament-push`.
4. Set Edge Function secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
5. In Supabase Database Webhooks, create an `INSERT` webhook on `public.notifications` targeting `send-tournament-push`. Send `Authorization: Bearer <service-role-key>` as a server-side webhook header. Do not put this key in client code.

The function records delivery attempts and removes tokens rejected as `DeviceNotRegistered`. See [Deployment](docs/DEPLOYMENT.md).

## Tests and Checks

```powershell
npm test
npm run typecheck
npx expo-doctor
```

The automated unit tests cover fixture generation for even and odd team counts, league table calculations, pending/final exclusion, corrections, recent form, and final eligibility/winner rules. Backend RLS and migration tests require a configured local or hosted Supabase project; see [Testing](docs/TESTING.md).

## Builds

After setting your own app identifiers and EAS project:

```powershell
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
npm run build:android
npm run build:ios
```

The production Android profile outputs an App Bundle. iOS builds require Apple signing setup and a macOS-compatible EAS cloud build. These commands have not been run as part of initial setup. See [Deployment](docs/DEPLOYMENT.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)
