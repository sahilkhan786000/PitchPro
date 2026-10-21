import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AuthGlassPanel } from "@/src/components/AuthGlassPanel";
import { AuthVideoBackground } from "@/src/components/AuthVideoBackground";
import { useAuth } from "@/src/lib/auth";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const { mode } = useAppTheme();
  const blurTargetRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setFormError("");
    try {
      await signIn(values.email.trim(), values.password);
      const nextPath =
        typeof params.next === "string" && params.next.startsWith("/join/")
          ? {
              pathname: "/join/[token]" as const,
              params: { token: params.next.slice("/join/".length) },
            }
          : "/(tabs)";
      router.replace(nextPath);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Sign in failed. Try again.",
      );
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <AuthVideoBackground blurTargetRef={blurTargetRef} />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
        >
          <AuthGlassPanel blurTargetRef={blurTargetRef} style={styles.panel}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={styles.back}
            >
              <ArrowLeft
                color={mode === "light" ? "#1D2A3A" : colors.muted}
                size={19}
              />
            </Pressable>
            <Text style={styles.title}>Sign in</Text>

            <View style={styles.fieldGroup}>
              <Text
                style={[styles.label, mode === "light" && styles.lightMutedText]}
              >
                EMAIL
              </Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.dim}
                    style={[styles.input, errors.email && styles.inputError]}
                  />
                )}
              />
              {errors.email ? (
                <Text style={styles.error}>{errors.email.message}</Text>
              ) : null}
            </View>
            <View style={styles.fieldGroup}>
              <Text
                style={[styles.label, mode === "light" && styles.lightMutedText]}
              >
                PASSWORD
              </Text>
              <View
                style={[
                  styles.passwordWrap,
                  errors.password && styles.inputError,
                ]}
              >
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      autoComplete="current-password"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      secureTextEntry={!showPassword}
                      placeholder="Your password"
                      placeholderTextColor={colors.dim}
                      style={styles.passwordInput}
                      onSubmitEditing={() => void submit()}
                      returnKeyType="go"
                    />
                  )}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onPress={() => setShowPassword((visible) => !visible)}
                  style={styles.eye}
                >
                  {showPassword ? (
                    <EyeOff
                      color={mode === "light" ? "#1D2A3A" : colors.muted}
                      size={18}
                    />
                  ) : (
                    <Eye
                      color={mode === "light" ? "#1D2A3A" : colors.muted}
                      size={18}
                    />
                  )}
                </Pressable>
              </View>
              {errors.password ? (
                <Text style={styles.error}>{errors.password.message}</Text>
              ) : null}
            </View>
            <Link
              href="/forgot-password"
              style={[styles.forgot, mode === "light" && styles.lightLinkText]}
            >
              Forgot password?
            </Link>
            {formError ? (
              <View style={styles.errorPanel}>
                <LockKeyhole color={colors.danger} size={16} />
                <Text style={styles.errorPanelText}>{formError}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void submit()}
              style={[styles.submit, isSubmitting && styles.disabled]}
            >
              <Text
                style={[
                  styles.submitText,
                  mode === "light" && styles.lightButtonText,
                ]}
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Text>
            </Pressable>
            <View style={styles.signupRow}>
              <Text
                style={[
                  styles.footer,
                  mode === "light" && styles.lightMutedText,
                ]}
              >
                New to PitchPro?{" "}
              </Text>
              <Link
                href="/signup"
                style={[styles.signup, mode === "light" && styles.lightLinkText]}
              >
                Create account
              </Link>
            </View>
          </AuthGlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: {
    flex: 1,
    position: "relative",
    backgroundColor: "transparent",
  },
  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: spacing.xl,
    paddingTop: spacing.md,
    justifyContent: "center",
  },
  panel: { padding: spacing.xl },
  back: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  fieldGroup: { marginBottom: spacing.lg },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  lightMutedText: { color: "#1D2A3A" },
  lightLinkText: { color: "#0C416B" },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  passwordWrap: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  eye: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  forgot: {
    color: colors.accent,
    alignSelf: "flex-end",
    fontSize: 12,
    fontWeight: "800",
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorPanel: {
    backgroundColor: "#3A2225",
    borderRadius: radii.sm,
    padding: spacing.md,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  errorPanelText: { flex: 1, color: "#FFB6BA", fontSize: 12, lineHeight: 17 },
  submit: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  submitText: { color: colors.background, fontWeight: "900", fontSize: 14 },
  lightButtonText: { color: colors.text },
  disabled: { opacity: 0.55 },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  footer: { color: colors.muted, fontSize: 13 },
  signup: { color: colors.accent, fontSize: 13, fontWeight: "800" },
});
