import { Link } from "expo-router";
import { ArrowRight, LockKeyhole, Settings2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { useThemeRefresh } from "../theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "../theme/tokens";

export function AuthGate({ children }: { children: React.ReactNode }) {
  useThemeRefresh();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.muted}>Restoring your session…</Text>
      </SafeAreaView>
    );
  }

  if (!supabaseConfigured) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.lockup}>
          <Settings2 color={colors.accent} size={18} />
          <Text style={styles.brand}>PITCHPRO</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.kicker}>BACKEND SETUP</Text>
          <Text style={styles.title}>Bring your competition online.</Text>
          <Text style={styles.body}>
            Add your Supabase project URL and publishable key to the local
            environment, then apply the database migration.
          </Text>
          <View style={styles.code}>
            <Text style={styles.codeText}>EXPO_PUBLIC_SUPABASE_URL</Text>
            <Text style={styles.codeText}>EXPO_PUBLIC_SUPABASE_KEY</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.lockup}>
          <Settings2 color={colors.accent} size={18} />
          <Text style={styles.brand}>PITCHPRO</Text>
        </View>
        <View style={styles.panel}>
          <View style={styles.icon}>
            <LockKeyhole color={colors.accent} size={22} />
          </View>
          <Text style={styles.kicker}>YOUR COMPETITION HQ</Text>
          <Text style={styles.title}>Every match has a story.</Text>
          <Text style={styles.body}>
            Sign in to manage teams, run fixtures, and follow the table as
            results come in.
          </Text>
          <Link href="/login" style={styles.primaryLink}>
            Sign in <ArrowRight color={colors.background} size={17} />
          </Link>
          <Link href="/signup" style={styles.secondaryLink}>
            Create account
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = createThemedStyles({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    position: "absolute",
    top: 60,
    left: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brand: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  panel: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: "#21372B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.xl,
  },
  code: {
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  codeText: { color: colors.accent, fontFamily: "SpaceMono", fontSize: 11 },
  primaryLink: {
    minHeight: 48,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    color: colors.background,
    fontWeight: "900",
    overflow: "hidden",
  },
  secondaryLink: {
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
    padding: spacing.lg,
  },
  muted: { color: colors.muted },
});
