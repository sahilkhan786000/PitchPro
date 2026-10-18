import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  const androidPackage = process.env.PITCHPRO_ANDROID_PACKAGE;
  const iosBundleIdentifier = process.env.PITCHPRO_IOS_BUNDLE_ID;

  return {
    ...config,
    name: "PitchPro",
    slug: "pitchpro",
    scheme: "pitchpro",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    ios: {
      ...config.ios,
      supportsTablet: true,
      ...(iosBundleIdentifier ? { bundleIdentifier: iosBundleIdentifier } : {}),
    },
    android: {
      ...config.android,
      ...(androidPackage ? { package: androidPackage } : {}),
      versionCode: config.android?.versionCode ?? 1,
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
