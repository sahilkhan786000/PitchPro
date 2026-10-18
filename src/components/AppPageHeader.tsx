import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, House, MoonStar, SunMedium, Trophy } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import {
  countUnreadNotifications,
  subscribeToNotifications,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { supabaseConfigured } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

export function AppPageHeader({ showBrand = true }: { showBrand?: boolean }) {
  const { club, session, clearClub } = useAuth();
  const { mode, toggleTheme } = useAppTheme();
  const queryClient = useQueryClient();
  const unreadQuery = useQuery({
    queryKey: ["unread-notification-count", session?.user.id],
    queryFn: countUnreadNotifications,
    enabled: Boolean(session && club),
  });

  useEffect(() => {
    if (!session || !club || !supabaseConfigured) return;
    return subscribeToNotifications(session.user.id, () => {
      void queryClient.invalidateQueries({
        queryKey: ["unread-notification-count", session.user.id],
      });
    });
  }, [queryClient, session]);

  const handleClearClub = async () => {
    await clearClub();
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {club ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave Club"
            onPress={handleClearClub}
            style={styles.iconButton}
          >
            <House color={colors.text} size={18} />
          </Pressable>
        ) : null}
        {showBrand ? (
          <View style={styles.brandLockup}>
            <View style={styles.brandMark}>
              <Trophy color={colors.background} size={15} strokeWidth={2.7} />
            </View>
            <Text numberOfLines={1} style={styles.brand}>
              {club?.name ?? "PitchPRO"}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          onPress={toggleTheme}
          style={styles.iconButton}
        >
          {mode === "dark" ? (
            <SunMedium color={colors.text} size={18} />
          ) : (
            <MoonStar color={colors.text} size={18} />
          )}
        </Pressable>
        {club ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push("/(tabs)/notifications")}
            style={styles.iconButton}
          >
            <Bell color={colors.text} size={19} />
            {(unreadQuery.data ?? 0) > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {Math.min(unreadQuery.data ?? 0, 99)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadCount: { color: colors.text, fontSize: 8, fontWeight: "900" },
});
