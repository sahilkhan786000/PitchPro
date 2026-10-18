import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Eye, EyeOff, Trophy } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { supabase } from "@/src/lib/supabase";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const schema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter."),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });
type Values = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  useThemeRefresh();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const submit = handleSubmit(async ({ password }) => {
    setError("");
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setMessage("Password updated. Sign in with your new password.");
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Trophy color={colors.background} size={16} />
          </View>
          <Text style={styles.brandText}>PITCHPRO</Text>
        </View>
        <Text style={styles.kicker}>SECURE YOUR ACCOUNT</Text>
        <Text style={styles.title}>Choose a new password.</Text>
        <Field
          label="NEW PASSWORD"
          name="password"
          control={control}
          visible={visible}
          onToggle={() => setVisible((value) => !value)}
          error={errors.password?.message}
        />
        <Field
          label="CONFIRM PASSWORD"
          name="confirm"
          control={control}
          visible={visible}
          onToggle={() => setVisible((value) => !value)}
          error={errors.confirm?.message}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || Boolean(message)}
          onPress={() => void submit()}
          style={[styles.submit, isSubmitting && styles.disabled]}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Text>
        </Pressable>
        {message ? (
          <Pressable
            onPress={() => router.replace("/login")}
            style={styles.back}
          >
            <Text style={styles.backText}>Return to sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  name,
  control,
  visible,
  onToggle,
  error,
}: {
  label: string;
  name: "password" | "confirm";
  control: ReturnType<typeof useForm<Values>>["control"];
  visible: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputError]}>
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!visible}
              placeholder="10+ characters"
              placeholderTextColor={colors.dim}
              style={styles.input}
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
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: spacing.xl,
    justifyContent: "center",
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
    fontSize: 27,
    fontWeight: "900",
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.lg },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  inputWrap: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    height: "100%",
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  eye: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  success: { color: colors.accent, fontSize: 13, marginBottom: spacing.md },
  submit: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.md,
  },
  submitText: { color: colors.background, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  back: { padding: spacing.lg, alignItems: "center" },
  backText: { color: colors.accent, fontWeight: "800" },
});
