import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Check,
  ImagePlus,
  Plus,
  Search,
  Shield,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AuthGate } from "@/src/components/AuthGate";
import {
  createTeam,
  getSignedLogoUrl,
  listTeams,
  type TeamRecord,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a team name.")
    .max(60, "Use 60 characters or fewer."),
});
type Values = z.infer<typeof schema>;
const maxBytes = 5 * 1024 * 1024;

export default function TeamsScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <TeamsContent />
    </AuthGate>
  );
}

function TeamsContent() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const teamsQuery = useQuery({
    queryKey: ["teams", session?.user.id],
    queryFn: () => listTeams(session?.user.id),
    enabled: Boolean(session),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name }: Values) => {
      let path: string | null = null;
      try {
        if (asset) {
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(
              asset.mimeType ?? "",
            )
          )
            throw new Error("Choose a PNG, JPEG, or WebP image.");
          if (
            asset.width < 64 ||
            asset.height < 64 ||
            asset.width > 4096 ||
            asset.height > 4096
          )
            throw new Error(
              "Image dimensions must be between 64 and 4096 pixels.",
            );
          if (!supabase || !session)
            throw new Error(
              "Your session is no longer available. Sign in again.",
            );
          setUploading(true);
          const blob = await fetch(asset.uri).then((response) =>
            response.blob(),
          );
          if (blob.size > maxBytes)
            throw new Error("Logo files must be 5 MB or smaller.");
          const extension =
            asset.mimeType === "image/png"
              ? "png"
              : asset.mimeType === "image/webp"
                ? "webp"
                : "jpg";
          const uniqueName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
          path = `${session.user.id}/${uniqueName}`;
          const { error } = await supabase.storage
            .from("team-logos")
            .upload(path, blob, { contentType: asset.mimeType, upsert: false });
          if (error) throw error;
        }
        return await createTeam(name, path);
      } catch (error) {
        if (path && supabase)
          await supabase.storage.from("team-logos").remove([path]);
        throw error;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setModalVisible(false);
      setAsset(null);
      reset({ name: "" });
    },
  });

  const chooseLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access required",
        "Allow photo library access to choose a team logo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) setAsset(result.assets[0] ?? null);
  };
  const teams = (teamsQuery.data ?? []).filter((team) =>
    team.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const submit = handleSubmit((values) => createMutation.mutateAsync(values));

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerActions}>
            <Text style={styles.title}>Teams</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create team"
              onPress={() => setModalVisible(true)}
              style={styles.addButton}
            >
              <Plus color={colors.background} size={20} />
            </Pressable>
          </View>
        </View>
        <View style={styles.search}>
          <Search color={colors.muted} size={17} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search teams"
            placeholderTextColor={colors.dim}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.countRow}>
          <Text style={styles.count}>{teamsQuery.data?.length ?? 0} TEAMS</Text>
          <Text style={styles.countNote}>
            Only you can edit your club details
          </Text>
        </View>
        {teamsQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : null}
        {teamsQuery.isError ? (
          <Pressable
            onPress={() => teamsQuery.refetch()}
            style={styles.message}
          >
            <Text style={styles.errorText}>
              Could not load teams. Tap to retry.
            </Text>
          </Pressable>
        ) : null}
        {!teamsQuery.isLoading && !teams.length ? (
          <View style={styles.empty}>
            <View style={styles.emptyMark}>
              <Shield color={colors.accent} size={25} />
            </View>
            <Text style={styles.emptyTitle}>
              {search ? "No teams found" : "Your roster starts here"}
            </Text>
            <Text style={styles.emptyBody}>
              {search
                ? "Try another team name."
                : "Create your first team, then select it for any tournament you manage."}
            </Text>
            {!search ? (
              <Pressable
                onPress={() => setModalVisible(true)}
                style={styles.emptyButton}
              >
                <Plus color={colors.background} size={17} />
                <Text style={styles.emptyButtonText}>Create team</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.list}>
          {teams.map((team) => (
            <TeamRow key={team.id} team={team} />
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New team</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => {
                setModalVisible(false);
                createMutation.reset();
              }}
              style={styles.close}
            >
              <X color={colors.text} size={20} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>TEAM NAME</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. Riverside Athletic"
                  placeholderTextColor={colors.dim}
                  maxLength={60}
                  style={[styles.nameInput, errors.name && styles.inputError]}
                />
              )}
            />
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name.message}</Text>
            ) : null}
            <Text style={[styles.fieldLabel, { marginTop: spacing.xl }]}>
              TEAM CREST
            </Text>
            <View style={styles.uploadBox}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  asset ? "Replace team logo" : "Add team logo"
                }
                onPress={() => void chooseLogo()}
                style={styles.uploadAction}
              >
                {asset ? (
                  <Image source={{ uri: asset.uri }} style={styles.preview} />
                ) : (
                  <View style={styles.uploadIcon}>
                    <ImagePlus color={colors.accent} size={22} />
                  </View>
                )}
                <View style={styles.uploadCopy}>
                  <Text style={styles.uploadTitle}>
                    {asset ? "Replace image" : "Add a logo"}
                  </Text>
                  <Text style={styles.uploadHint}>
                    PNG, JPEG, or WebP · 5 MB max
                  </Text>
                </View>
              </Pressable>
              {asset ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove logo"
                  onPress={() => setAsset(null)}
                  style={styles.removeImage}
                >
                  <X color={colors.muted} size={17} />
                </Pressable>
              ) : (
                <Camera color={colors.muted} size={18} />
              )}
            </View>
            {createMutation.error ? (
              <Text style={styles.errorText}>
                {createMutation.error.message}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable
              accessibilityRole="button"
              disabled={createMutation.isPending}
              onPress={() => void submit()}
              style={[
                styles.saveButton,
                createMutation.isPending && styles.disabled,
              ]}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Check color={colors.background} size={18} />
                  <Text style={styles.saveText}>
                    {uploading ? "Uploading logo…" : "Create team"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TeamRow({ team }: { team: TeamRecord }) {
  const logoQuery = useQuery({
    queryKey: ["team-logo", team.logo_path],
    queryFn: () => getSignedLogoUrl("team-logos", team.logo_path!),
    enabled: Boolean(team.logo_path),
    staleTime: 45 * 60 * 1000,
  });
  return (
    <View style={styles.teamRow}>
      <View style={styles.crest}>
        {logoQuery.data ? (
          <Image source={{ uri: logoQuery.data }} style={styles.crestImage} />
        ) : (
          <Text style={styles.crestText}>
            {team.name.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.teamDetails}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.teamDate}>
          Created {new Date(team.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.owned}>YOURS</Text>
    </View>
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
  header: {
    alignItems: "stretch",
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.lg,
  },
  count: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  countNote: { color: colors.dim, fontSize: 10 },
  list: { gap: 9 },
  teamRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  crest: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
    overflow: "hidden",
  },
  crestImage: { width: "100%", height: "100%" },
  crestText: { color: colors.accent, fontSize: 18, fontWeight: "900" },
  teamDetails: { flex: 1 },
  teamName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  teamDate: { color: colors.muted, fontSize: 11, marginTop: 5 },
  owned: {
    color: colors.dim,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  empty: {
    alignItems: "center",
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  emptyMark: {
    width: 52,
    height: 52,
    backgroundColor: "#21372B",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  emptyButton: {
    marginTop: spacing.lg,
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  emptyButtonText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "900",
  },
  loader: { marginTop: spacing.xxl },
  message: { padding: spacing.lg, alignItems: "center" },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 7 },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  close: {
    width: 38,
    height: 38,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  modalBody: {
    padding: spacing.lg,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  nameInput: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  inputError: { borderColor: colors.danger },
  uploadBox: {
    minHeight: 76,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  uploadAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  uploadIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#21372B",
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { width: 46, height: 46, borderRadius: 12 },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: colors.text, fontWeight: "800", fontSize: 13 },
  uploadHint: { color: colors.muted, fontSize: 10, marginTop: 5 },
  removeImage: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  saveText: { color: colors.background, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
