import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  Trophy,
} from "lucide-react-native";
import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/src/components/AuthGate";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
  subscribeToNotifications,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { supabaseConfigured } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/ThemeContext";
import {
  colors,
  getThemeColors,
  radii,
  spacing,
  type ThemeMode,
} from "@/src/theme/tokens";

export default function NotificationsScreen() {
  return (
    <AuthGate>
      <NotificationsContent />
    </AuthGate>
  );
}

function NotificationsContent() {
  const { mode } = useAppTheme();
  const themeColors = getThemeColors(mode);
  const styles = useMemo(() => createStyles(themeColors, mode), [mode]);
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", session?.user.id],
    queryFn: listNotifications,
    enabled: Boolean(session),
  });
  const unreadQuery = useQuery({
    queryKey: ["unread-notification-count", session?.user.id],
    queryFn: countUnreadNotifications,
    enabled: Boolean(session),
  });
  const markMutation = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({
        queryKey: ["unread-notification-count"],
      });
    },
  });
  const notifications = query.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;

  useEffect(() => {
    if (!session || !supabaseConfigured) return;
    return subscribeToNotifications(session.user.id, () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", session.user.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["unread-notification-count", session.user.id],
      });
    });
  }, [queryClient, session]);

  const openNotification = async (
    notification: (typeof notifications)[number],
  ) => {
    if (!notification.read_at) await markMutation.mutateAsync(notification.id);
    const fixtureId =
      notification.entity_type === "fixture" ? notification.entity_id : null;
    router.push({
      pathname: "/tournament/[id]",
      params: {
        id: notification.tournament_id,
        ...(fixtureId ? { fixtureId } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Updates</Text>
        </View>
        <View style={styles.toolbar}>
          <Text style={styles.count}>{unreadCount} UNREAD</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!unreadCount || markMutation.isPending}
            onPress={() => markMutation.mutate(undefined)}
            style={styles.markAll}
          >
            <Check
              color={unreadCount ? themeColors.accent : themeColors.dim}
              size={15}
            />
            <Text style={[styles.markAllText, !unreadCount && styles.dim]}>
              Mark all read
            </Text>
          </Pressable>
        </View>
        {query.isLoading ? (
          <ActivityIndicator color={themeColors.accent} style={styles.loader} />
        ) : null}
        {query.isError ? (
          <Pressable onPress={() => query.refetch()} style={styles.empty}>
            <CircleAlert color={themeColors.danger} size={21} />
            <Text style={styles.emptyTitle}>Updates couldn’t load</Text>
            <Text style={styles.emptyBody}>Tap to retry.</Text>
          </Pressable>
        ) : null}
        {!query.isLoading && !query.isError && !notifications.length ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Trophy color={themeColors.accent} size={23} />
            </View>
            <Text style={styles.emptyTitle}>Quiet on the touchline.</Text>
            <Text style={styles.emptyBody}>
              Tournament activity and result updates will appear here.
            </Text>
          </View>
        ) : null}
        <View style={styles.list}>
          {notifications.map((notification) => (
            <Pressable
              key={notification.id}
              accessibilityRole="button"
              onPress={() => void openNotification(notification)}
              style={[styles.row, !notification.read_at && styles.unread]}
            >
              <View
                style={[
                  styles.marker,
                  !notification.read_at && styles.markerUnread,
                ]}
              >
                <Bell
                  color={
                    !notification.read_at
                      ? themeColors.accent
                      : themeColors.muted
                  }
                  size={17}
                />
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {notification.title}
                  </Text>
                  {!notification.read_at ? (
                    <View style={styles.unreadDot} />
                  ) : null}
                </View>
                <Text style={styles.tournamentName} numberOfLines={1}>
                  {notification.tournaments?.[0]?.name ?? "Tournament"}
                </Text>
                <Text style={styles.description} numberOfLines={2}>
                  {notification.body}
                </Text>
                <Text style={styles.time}>
                  {new Date(notification.created_at).toLocaleString()}
                </Text>
              </View>
              <ChevronRight color={themeColors.dim} size={17} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(palette: typeof colors, mode: ThemeMode) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.background },
    page: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    header: {
      alignItems: "stretch",
      marginTop: spacing.md,
      marginBottom: spacing.xl,
    },
    title: { color: palette.text, fontSize: 30, fontWeight: "900" },
    toolbar: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      marginBottom: spacing.md,
    },
    count: {
      color: palette.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.9,
    },
    markAll: { flexDirection: "row", alignItems: "center", gap: 6, padding: 7 },
    markAllText: { color: palette.accent, fontSize: 11, fontWeight: "800" },
    dim: { color: palette.dim },
    loader: { marginTop: spacing.xxl },
    list: { gap: 7 },
    row: {
      minHeight: 80,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: spacing.md,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radii.sm,
    },
    unread: {
      borderColor: mode === "dark" ? "#385343" : "#B9D8FF",
      backgroundColor: mode === "dark" ? "#18251E" : "#EFF7FF",
    },
    marker: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: palette.elevated,
    },
    markerUnread: {
      backgroundColor: mode === "dark" ? "#21372B" : "#DCEEFF",
    },
    copy: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowTitle: { flex: 1, color: palette.text, fontSize: 12, fontWeight: "800" },
    tournamentName: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 3,
    },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.accent,
    },
    description: {
      color: palette.muted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
    },
    time: { color: palette.dim, fontSize: 9, marginTop: 5 },
    empty: {
      minHeight: 190,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radii.md,
      padding: spacing.xl,
      gap: 8,
    },
    emptyIcon: {
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: mode === "dark" ? "#21372B" : "#EAF3FF",
      marginBottom: spacing.sm,
    },
    emptyTitle: { color: palette.text, fontSize: 15, fontWeight: "900" },
    emptyBody: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
  });
}
