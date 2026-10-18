import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Check,
  Link2,
  ShieldCheck,
  Trophy,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { acceptTournamentInvite } from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

export default function JoinTournamentScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const joinMutation = useMutation({
    mutationFn: () => acceptTournamentInvite(token),
    onSuccess: async (tournamentId) => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      router.replace({
        pathname: "/tournament/[id]",
        params: { id: tournamentId },
      });
    },
  });
  const nextPath = `/join/${encodeURIComponent(token)}`;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={session ? ["left", "right", "bottom"] : undefined}
    >
      <View style={styles.page}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color={colors.muted} size={19} />
        </Pressable>
        {!session ? (
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Trophy color={colors.background} size={15} />
            </View>
            <Text style={styles.brandText}>PITCHPRO</Text>
          </View>
        ) : null}
        <View style={styles.panel}>
          <View style={styles.icon}>
            <Link2 color={colors.accent} size={21} />
          </View>
          <Text style={styles.kicker}>TOURNAMENT INVITATION</Text>
          <Text style={styles.title}>
            {session ? "Join the competition." : "Your seat is ready."}
          </Text>
          <Text style={styles.body}>
            {session
              ? "Accept this single-use invitation to follow fixtures, results, standings, and tournament activity."
              : "Sign in or create a PitchPro account to accept this read-only tournament invitation."}
          </Text>
          {session ? (
            <>
              <View style={styles.permission}>
                <ShieldCheck color={colors.accent} size={17} />
                <Text style={styles.permissionText}>
                  Read-only access · valid for a limited time
                </Text>
              </View>
              {joinMutation.error ? (
                <Text style={styles.error}>{joinMutation.error.message}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={!token || joinMutation.isPending}
                onPress={() => joinMutation.mutate()}
                style={[
                  styles.action,
                  (!token || joinMutation.isPending) && styles.disabled,
                ]}
              >
                {joinMutation.isPending ? (
                  <Text style={styles.actionText}>Joining…</Text>
                ) : (
                  <>
                    <Text style={styles.actionText}>Accept invitation</Text>
                    <Check color={colors.background} size={17} />
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Link
                href={{ pathname: "/login", params: { next: nextPath } }}
                style={styles.actionLink}
              >
                Sign in to accept
              </Link>
              <Link
                href={{ pathname: "/signup", params: { next: nextPath } }}
                style={styles.secondaryLink}
              >
                Create account
              </Link>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  back: {
    position: "absolute",
    top: 18,
    left: spacing.xl,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: spacing.xl,
  },
  brandIcon: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  icon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#21372B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  permission: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  permissionText: { color: colors.muted, fontSize: 10, flex: 1 },
  action: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  actionText: { color: colors.background, fontSize: 12, fontWeight: "900" },
  actionLink: {
    minHeight: 48,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    color: colors.background,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
  },
  secondaryLink: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    padding: spacing.lg,
  },
  error: { color: colors.danger, fontSize: 11, marginBottom: spacing.md },
  disabled: { opacity: 0.55 },
});
