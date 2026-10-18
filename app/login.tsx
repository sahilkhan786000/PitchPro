import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Trophy,
} from "lucide-react-native";
import { useState } from "react";
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

import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof schema>;

export default function LoginScreen() {
  useThemeRefresh();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const {
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setFormError("");
    setResendMessage("");
    setResendError("");
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

  const resendConfirmation = async () => {
    const email = getValues("email").trim();
    if (!z.email().safeParse(email).success) {
      setResendError("Enter a valid email address first.");
      return;
    }
    if (!supabase) {
      setResendError("Supabase is not configured.");
      return;
    }

    setResendPending(true);
    setResendMessage("");
    setResendError("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setResendMessage(
        "A new confirmation email was sent. Open the latest link to verify your account.",
      );
    } catch (error) {
      setResendError(
        error instanceof Error
          ? error.message
          : "Could not resend the confirmation email.",
      );
    } finally {
      setResendPending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.back}
          >
            <ArrowLeft color={colors.muted} size={19} />
          </Pressable>
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Trophy color={colors.background} size={16} />
            </View>
            <Text style={styles.brandText}>PITCHPRO</Text>
          </View>
          <Text style={styles.kicker}>WELCOME BACK</Text>
          <Text style={styles.title}>The table’s waiting.</Text>
          <Text style={styles.subtitle}>
            Sign in to pick up where your competition left off.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL</Text>
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
            <Text style={styles.label}>PASSWORD</Text>
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
                  <EyeOff color={colors.muted} size={18} />
                ) : (
                  <Eye color={colors.muted} size={18} />
                )}
              </Pressable>
            </View>
            {errors.password ? (
              <Text style={styles.error}>{errors.password.message}</Text>
            ) : null}
          </View>
          <Link href="/forgot-password" style={styles.forgot}>
            Forgot password?
          </Link>
          {formError ? (
            <View style={styles.errorPanel}>
              <LockKeyhole color={colors.danger} size={16} />
              <Text style={styles.errorPanelText}>{formError}</Text>
            </View>
          ) : null}
          {formError.toLowerCase().includes("email not confirmed") ? (
            <View>
              <Pressable
                accessibilityRole="button"
                disabled={resendPending}
                onPress={() => void resendConfirmation()}
                style={styles.resendLink}
              >
                <Text style={styles.resendText}>
                  {resendPending
                    ? "Sending confirmation…"
                    : "Resend confirmation email"}
                </Text>
              </Pressable>
              {resendMessage ? (
                <Text style={styles.resendMessage}>{resendMessage}</Text>
              ) : null}
              {resendError ? (
                <Text style={styles.error}>{resendError}</Text>
              ) : null}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[styles.submit, isSubmitting && styles.disabled]}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>
          <View style={styles.signupRow}>
            <Text style={styles.footer}>New to PitchPro? </Text>
            <Link href="/signup" style={styles.signup}>
              Create account
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: spacing.xl,
    paddingTop: spacing.md,
    justifyContent: "center",
  },
  back: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 42,
  },
  brandIcon: {
    width: 30,
    height: 30,
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
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  fieldGroup: { marginBottom: spacing.lg },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 8,
  },
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
  resendLink: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  resendText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  resendMessage: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  submit: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  submitText: { color: colors.background, fontWeight: "900", fontSize: 14 },
  disabled: { opacity: 0.55 },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  footer: { color: colors.muted, fontSize: 13 },
  signup: { color: colors.accent, fontSize: 13, fontWeight: "800" },
});
