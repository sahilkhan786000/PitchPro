import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Eye, EyeOff, Trophy } from "lucide-react-native";
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
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const schema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(80, "Use 80 characters or fewer."),
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
type SignupValues = z.infer<typeof schema>;

export default function SignupScreen() {
  useThemeRefresh();
  const { signUp } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState("");
  const [complete, setComplete] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError("");
    try {
      const nextPath =
        typeof params.next === "string" && params.next.startsWith("/join/")
          ? {
              pathname: "/join/[token]" as const,
              params: { token: params.next.slice("/join/".length) },
            }
          : "/(tabs)";
      const emailRedirectTo =
        typeof params.next === "string" && params.next.startsWith("/join/")
          ? `pitchpro://${params.next.slice(1)}`
          : undefined;
      const signedIn = await signUp(
        values.fullName,
        values.email.trim(),
        values.password,
        emailRedirectTo,
      );
      if (signedIn) router.replace(nextPath);
      else setComplete(true);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Account creation failed. Try again.",
      );
    }
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
          <Text style={styles.kicker}>
            {complete ? "ONE LAST STEP" : "START YOUR SEASON"}
          </Text>
          <Text style={styles.title}>
            {complete ? "Check your inbox." : "Create your account."}
          </Text>
          <Text style={styles.subtitle}>
            {complete
              ? "If email verification is enabled, follow the link we sent to finish setting up your manager profile."
              : "One account for every team, tournament, and matchday."}
          </Text>

          {!complete ? (
            <>
              <Field
                label="FULL NAME"
                name="fullName"
                control={control}
                error={errors.fullName?.message}
                placeholder="Your name"
                autoCapitalize="words"
              />
              <Field
                label="EMAIL"
                name="email"
                control={control}
                error={errors.email?.message}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <PasswordField
                label="PASSWORD"
                name="password"
                control={control}
                error={errors.password?.message}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
              <PasswordField
                label="CONFIRM PASSWORD"
                name="confirmPassword"
                control={control}
                error={errors.confirmPassword?.message}
                visible={showConfirm}
                onToggle={() => setShowConfirm((value) => !value)}
              />
              {formError ? (
                <View style={styles.errorPanel}>
                  <Text style={styles.errorPanelText}>{formError}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void submit()}
                style={[styles.submit, isSubmitting && styles.disabled]}
              >
                <Text style={styles.submitText}>
                  {isSubmitting ? "Creating account…" : "Create account"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/login")}
              style={styles.submit}
            >
              <Text style={styles.submitText}>Continue to sign in</Text>
            </Pressable>
          )}
          <View style={styles.footerRow}>
            <Text style={styles.footer}>
              {complete ? "Already verified? " : "Already have an account? "}
            </Text>
            <Link href="/login" style={styles.login}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  name,
  control,
  error,
  placeholder,
  ...props
}: {
  label: string;
  name: "fullName" | "email";
  control: ReturnType<typeof useForm<SignupValues>>["control"];
  error?: string;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.dim}
            style={[styles.input, error && styles.inputError]}
            {...props}
          />
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function PasswordField({
  label,
  name,
  control,
  error,
  visible,
  onToggle,
}: {
  label: string;
  name: "password" | "confirmPassword";
  control: ReturnType<typeof useForm<SignupValues>>["control"];
  error?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.passwordWrap, error && styles.inputError]}>
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!visible}
              placeholder={
                name === "password" ? "10+ characters" : "Re-enter password"
              }
              placeholderTextColor={colors.dim}
              style={styles.passwordInput}
            />
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          onPress={onToggle}
          style={styles.eye}
        >
          {visible ? (
            <EyeOff color={colors.muted} size={18} />
          ) : (
            <Eye color={colors.muted} size={18} />
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
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
    marginBottom: spacing.lg,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: spacing.xl,
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
    marginBottom: spacing.lg,
  },
  fieldGroup: { marginBottom: spacing.md },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  passwordWrap: {
    height: 48,
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
  error: { color: colors.danger, fontSize: 11, marginTop: 5 },
  errorPanel: {
    backgroundColor: "#3A2225",
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorPanelText: { color: "#FFB6BA", fontSize: 12, lineHeight: 17 },
  submit: {
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  submitText: { color: colors.background, fontWeight: "900", fontSize: 14 },
  disabled: { opacity: 0.55 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  footer: { color: colors.muted, fontSize: 13 },
  login: { color: colors.accent, fontSize: 13, fontWeight: "800" },
});
