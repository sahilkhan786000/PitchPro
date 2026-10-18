import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ChevronRight,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

export default function ProfileScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <ProfileContent />
    </AuthGate>
  );
}

function ProfileContent() {
  const { session, signOut } = useAuth();
  const client = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: Boolean(session && supabase),
    queryFn: async () => {
      if (!supabase || !session) throw new Error("Session expired.");
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_path")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      client.clear();
      router.replace("/login");
    },
  });
  const name =
    profileQuery.data?.full_name ??
    session?.user.user_metadata.full_name ??
    "PitchPro Manager";
  const email = session?.user.email ?? "";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(name).slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>
        {profileQuery.isLoading ? (
          <ActivityIndicator
            color={colors.accent}
            style={{ margin: spacing.lg }}
          />
        ) : null}
        {profileQuery.isError ? (
          <Text style={styles.errorText}>Couldn’t load profile details.</Text>
        ) : null}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.infoRow}>
          <View style={styles.preferenceIcon}>
            <UserRound color={colors.muted} size={18} />
          </View>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>Email address</Text>
            <Text style={styles.preferenceBody}>{email}</Text>
          </View>
          <ShieldCheck color={colors.success} size={18} />
        </View>
        <View style={styles.infoRow}>
          <View style={styles.preferenceIcon}>
            <ShieldCheck color={colors.muted} size={18} />
          </View>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>Tournament access</Text>
            <Text style={styles.preferenceBody}>
              Private by default · owner and invited members
            </Text>
          </View>
          <ChevronRight color={colors.dim} size={18} />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={logout.isPending}
          onPress={() => logout.mutate()}
          style={styles.logout}
        >
          <LogOut color={colors.danger} size={17} />
          <Text style={styles.logoutText}>
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
        {logout.error ? (
          <Text style={styles.errorText}>{logout.error.message}</Text>
        ) : null}
        <Text style={styles.version}>PITCHPRO · VERSION 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: spacing.xl,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#21372B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.accent, fontSize: 21, fontWeight: "900" },
  identityCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "900" },
  email: { color: colors.muted, fontSize: 12, marginTop: 4 },
  sectionLabel: {
    color: colors.dim,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: spacing.lg,
  },
  preference: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  preferenceIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  preferenceBody: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 15,
  },
  infoRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: 7,
    borderRadius: radii.sm,
  },
  logout: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#57373A",
    backgroundColor: "#281E21",
    borderRadius: radii.sm,
    marginTop: spacing.xl,
  },
  logoutText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 8 },
  version: {
    color: colors.dim,
    textAlign: "center",
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: spacing.xl,
  },
});
