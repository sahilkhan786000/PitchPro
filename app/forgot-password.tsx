import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { ArrowLeft, Mail, Trophy } from "lucide-react-native";
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

import { supabase } from "@/src/lib/supabase";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const schema = z.object({ email: z.email("Enter a valid email address.") });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  useThemeRefresh();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });
  const submit = handleSubmit(async ({ email }) => {
    setMessage("");
    setError("");
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: "pitchpro://reset-password" },
    );
    if (requestError) setError(requestError.message);
    else
      setMessage(
        "If an account matches that address, a password reset link is on its way.",
      );
  });

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
          <Link href="/login" style={styles.back}>
            <ArrowLeft color={colors.muted} size={19} />
          </Link>
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Trophy color={colors.background} size={16} />
            </View>
            <Text style={styles.brandText}>PITCHPRO</Text>
          </View>
          <Text style={styles.kicker}>ACCOUNT RECOVERY</Text>
          <Text style={styles.title}>Reset your password.</Text>
          <Text style={styles.subtitle}>
            We’ll send a secure reset link to the email on your account.
          </Text>
          <Text style={styles.label}>EMAIL</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.dim}
                style={[styles.input, errors.email && styles.inputError]}
              />
            )}
          />
          {errors.email ? (
            <Text style={styles.error}>{errors.email.message}</Text>
          ) : null}
          {message ? (
            <View style={styles.success}>
              <Mail color={colors.accent} size={17} />
              <Text style={styles.successText}>{message}</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[styles.submit, isSubmitting && styles.disabled]}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Text>
          </Pressable>
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
    justifyContent: "center",
  },
  back: { width: 42, height: 42, marginBottom: spacing.xl },
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
    fontSize: 29,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
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
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 7 },
  success: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    backgroundColor: "#21372B",
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  successText: { color: colors.text, flex: 1, fontSize: 12, lineHeight: 18 },
  submit: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.xl,
  },
  submitText: { color: colors.background, fontWeight: "900", fontSize: 14 },
  disabled: { opacity: 0.55 },
});
