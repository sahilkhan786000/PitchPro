import { Link } from "expo-router";
import { ArrowRight, LockKeyhole } from "lucide-react-native";
import { useRef } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGlassPanel } from "./AuthGlassPanel";
import { AuthVideoBackground } from "./AuthVideoBackground";
import { useAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { useAppTheme } from "../theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "../theme/tokens";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { mode } = useAppTheme();
  const blurTargetRef = useRef<React.ComponentRef<typeof View> | null>(null);
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
        <View style={styles.panel}>
          <Text style={styles.kicker}>BACKEND SETUP</Text>
          <Text style={styles.title}>Bring your competition online.</Text>
          <Text style={[styles.body, mode === "light" && styles.lightMutedText]}>
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
        <AuthVideoBackground blurTargetRef={blurTargetRef} />
        <AuthGlassPanel blurTargetRef={blurTargetRef} style={styles.panel}>
          <View style={styles.icon}>
            <LockKeyhole color={colors.accent} size={22} />
          </View>
          <Text
            style={[styles.kicker, mode === "light" && styles.lightAccentText]}
          >
            YOUR COMPETITION HQ
          </Text>
          <Text style={styles.title}>Every match has a story.</Text>
          <Text style={[styles.body, mode === "light" && styles.lightMutedText]}>
            Sign in to manage teams, run fixtures, and follow the table as
            results come in.
          </Text>
          <Link href="/login" style={styles.primaryLink}>
            <View style={styles.primaryLinkContent}>
              <Text
                style={[
                  styles.primaryLinkText,
                  mode === "light" && styles.lightButtonText,
                ]}
              >
                Sign in
              </Text>
              <ArrowRight
                color={mode === "light" ? colors.text : colors.background}
                size={17}
              />
            </View>
          </Link>
          <Link href="/signup" style={styles.secondaryLink}>
            Create account
          </Link>
        </AuthGlassPanel>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = createThemedStyles({
  page: {
    flex: 1,
    position: "relative",
    backgroundColor: "transparent",
    padding: spacing.xl,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
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
    display: "flex",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryLinkText: {
    color: colors.background,
    fontWeight: "900",
  },
  lightButtonText: { color: colors.text },
  lightAccentText: { color: "#0C416B" },
  lightMutedText: { color: "#1D2A3A" },
  secondaryLink: {
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
    padding: spacing.lg,
  },
  muted: { color: colors.muted },
});
