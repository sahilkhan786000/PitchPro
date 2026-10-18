import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "../../lib/supabase";

export async function registerPushDevice(userId: string): Promise<void> {
  if (Platform.OS === "web")
    throw new Error(
      "Push registration is available in the Android and iOS app builds.",
    );
  if (!supabase) throw new Error("Supabase is not configured.");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("tournament-updates", {
      name: "Tournament updates",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 160, 100, 160],
      lightColor: "#39E879",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      ? current
      : await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    throw new Error(
      "Notification permission was not granted. In-app updates are still available.",
    );
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error(
      "Set up the EAS project ID before registering for push notifications.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from("push_devices").upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
    },
    { onConflict: "expo_push_token" },
  );
  if (error) throw error;
}
