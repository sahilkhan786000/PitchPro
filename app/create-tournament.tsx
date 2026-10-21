import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Plus,
  Search,
  Shield,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AuthGate } from "@/src/components/AuthGate";
import { TeamCrest } from "@/src/components/TeamCrest";
import { getCompetitionCounts } from "@/src/features/fixtures/roundRobin";
import {
  createTournament,
  listTeams,
  type TeamRecord,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const dateValue = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Use YYYY-MM-DD format.",
  )
  .refine((value) => {
    if (!value) return true;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date.");
const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Tournament name is required.")
      .max(100, "Use 100 characters or fewer."),
    description: z.string().max(2000, "Use 2000 characters or fewer."),
    startDate: dateValue,
    endDate: dateValue,
  })
  .refine(
    (values) =>
      !values.startDate ||
      !values.endDate ||
      values.endDate >= values.startDate,
    {
      path: ["endDate"],
      message: "End date must not be before the start date.",
    },
  );
type Values = z.infer<typeof schema>;

export default function CreateTournamentScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <CreateTournamentContent />
    </AuthGate>
  );
}

function CreateTournamentContent() {
  const { session, club } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const teamsQuery = useQuery({
    queryKey: ["eligible-teams", club?.id],
    queryFn: () => listTeams(club?.id ?? ""),
    enabled: Boolean(session && club),
    staleTime: 0,
  });
  const {
    control,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", startDate: "", endDate: "" },
    mode: "onTouched",
  });
  const filteredTeams = useMemo(
    () =>
      (teamsQuery.data ?? []).filter((team) =>
        team.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [search, teamsQuery.data],
  );
  const clubTeamIds = new Set((teamsQuery.data ?? []).map((team) => team.id));
  const selectedInClub = selected.filter((id) => clubTeamIds.has(id));
  const counts =
    selectedInClub.length >= 2
      ? getCompetitionCounts(selectedInClub.length)
      : null;
  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedInClub.length < 2)
        throw new Error("Select at least two teams from this Club.");
      if (!club) throw new Error("Enter a Club before creating a tournament.");
      const values = schema.parse(getValues());
      return createTournament({
        clubId: club.id,
        name: values.name,
        description: values.description,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        teamIds: selectedInClub,
      });
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      router.replace({ pathname: "/tournament/[id]", params: { id } });
    },
  });

  const toggleTeam = (id: string) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  const continueToTeams = async () => {
    if (await trigger()) setStep(2);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (step === 2 ? setStep(1) : router.back())}
          style={styles.back}
        >
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.progressStep, styles.progressActive]} />
          <View
            style={[styles.progressStep, step === 2 && styles.progressActive]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
          style={styles.back}
        >
          <X color={colors.muted} size={19} />
        </Pressable>
      </View>
      {step === 1 ? (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.kicker}>NEW COMPETITION · 01</Text>
          <Text style={styles.title}>Set the scene.</Text>
          <Text style={styles.subtitle}>
            Give your tournament a name and a place in the calendar.
          </Text>
          <Text style={styles.label}>TOURNAMENT NAME</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. Northside Cup"
                placeholderTextColor={colors.dim}
                maxLength={100}
                style={[styles.input, errors.name && styles.inputError]}
              />
            )}
          />
          {errors.name ? (
            <Text style={styles.error}>{errors.name.message}</Text>
          ) : null}
          <Text style={[styles.label, styles.fieldGap]}>
            DESCRIPTION <Text style={styles.optional}>OPTIONAL</Text>
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="A note for your members"
                placeholderTextColor={colors.dim}
                multiline
                maxLength={2000}
                style={[styles.input, styles.multiline]}
              />
            )}
          />
          <Text style={[styles.label, styles.fieldGap]}>
            DATES <Text style={styles.optional}>OPTIONAL</Text>
          </Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <CalendarDays color={colors.muted} size={16} />
              <Controller
                control={control}
                name="startDate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Start · YYYY-MM-DD"
                    placeholderTextColor={colors.dim}
                    style={styles.dateInput}
                    autoCapitalize="none"
                  />
                )}
              />
            </View>
            <View style={styles.dateField}>
              <CalendarDays color={colors.muted} size={16} />
              <Controller
                control={control}
                name="endDate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="End · YYYY-MM-DD"
                    placeholderTextColor={colors.dim}
                    style={styles.dateInput}
                    autoCapitalize="none"
                  />
                )}
              />
            </View>
          </View>
          {errors.startDate ? (
            <Text style={styles.error}>{errors.startDate.message}</Text>
          ) : null}
          {errors.endDate ? (
            <Text style={styles.error}>{errors.endDate.message}</Text>
          ) : null}
          <View style={styles.formatBanner}>
            <Shield color={colors.accent} size={18} />
            <View style={styles.formatCopy}>
              <Text style={styles.formatTitle}>Double round-robin + final</Text>
              <Text style={styles.formatSub}>
                Every team plays home and away. Top two advance.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void continueToTeams()}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Choose teams</Text>
            <ChevronRight color={colors.background} size={18} />
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.stepTwo}>
          <View style={styles.bodyHead}>
            <Text style={styles.kicker}>NEW COMPETITION · 02</Text>
            <Text style={styles.title}>Pick your sides.</Text>
            <Text style={styles.subtitle}>
              Choose teams you own or teams shared with you.
            </Text>
            <View style={styles.teamActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/teams")}
                style={styles.createTeamLink}
              >
                <Plus color={colors.accent} size={15} />
                <Text style={styles.createTeamText}>Create a new team</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void teamsQuery.refetch()}
                style={styles.createTeamLink}
              >
                <Text style={styles.createTeamText}>Refresh list</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.search}>
            <Search color={colors.muted} size={17} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Find a team"
              placeholderTextColor={colors.dim}
              style={styles.searchInput}
            />
          </View>
          <ScrollView contentContainerStyle={styles.teamList}>
            {teamsQuery.isLoading ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 40 }}
              />
            ) : null}
            {teamsQuery.isError ? (
              <Pressable onPress={() => teamsQuery.refetch()}>
                <Text style={styles.error}>
                  Couldn’t load teams. Tap to retry.
                </Text>
              </Pressable>
            ) : null}
            {!teamsQuery.isLoading && !filteredTeams.length ? (
              <View style={styles.noTeams}>
                <Text style={styles.noTeamsTitle}>No eligible teams yet</Text>
                <Text style={styles.noTeamsText}>
                  Create a team first, then return here to select it.
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/teams")}
                  style={styles.createTeamLink}
                >
                  <Text style={styles.createTeamText}>Go to Teams</Text>
                  <ChevronRight color={colors.accent} size={16} />
                </Pressable>
              </View>
            ) : null}
            {filteredTeams.map((team) => (
              <TeamOption
                key={team.id}
                team={team}
                ownerId={session?.user.id ?? ""}
                selected={selected.includes(team.id)}
                onPress={() => toggleTeam(team.id)}
              />
            ))}
          </ScrollView>
          <View style={styles.bottomPanel}>
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionCount}>
                {selected.length} selected
              </Text>
              <Text style={styles.selectionFoot}>
                {counts
                  ? `${counts.fixtureCount} league fixtures · ${counts.matchdayCount} matchdays`
                  : "Choose at least two teams"}
              </Text>
            </View>
            <View style={styles.bottomActions}>
              <Pressable onPress={() => setStep(1)} style={styles.backButton}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!counts || mutation.isPending}
                onPress={() => mutation.mutate()}
                style={[
                  styles.primary,
                  styles.createButton,
                  (!counts || mutation.isPending) && styles.disabled,
                ]}
              >
                {mutation.isPending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Create tournament</Text>
                    <Check color={colors.background} size={17} />
                  </>
                )}
              </Pressable>
            </View>
            {mutation.error ? (
              <Text style={styles.error}>{mutation.error.message}</Text>
            ) : null}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function TeamOption({
  team,
  ownerId,
  selected,
  onPress,
}: {
  team: TeamRecord;
  ownerId: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.teamOption, selected && styles.teamOptionSelected]}
    >
      <TeamCrest name={team.name} logoPath={team.logo_path} size={39} />
      <View style={styles.teamCopy}>
        <Text style={styles.teamName}>{team.name}</Text>
        <Text style={styles.teamOwner}>
          {team.owner_id === ownerId ? "Your team" : "Shared team"}
        </Text>
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <Check color={colors.background} size={14} /> : null}
      </View>
    </Pressable>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    height: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: { flexDirection: "row", gap: 7 },
  progressStep: {
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressActive: { backgroundColor: colors.accent },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  bodyHead: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  teamActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: spacing.xl,
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
    fontSize: 13,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  optional: { color: colors.dim, fontSize: 9 },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 11, marginTop: 6 },
  fieldGap: { marginTop: spacing.lg },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
    paddingTop: spacing.md,
  },
  dateRow: { gap: 8 },
  dateField: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  dateInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 12 },
  formatBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#1B2E23",
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.xl,
  },
  formatCopy: { flex: 1 },
  formatTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  formatSub: { color: colors.muted, fontSize: 10, marginTop: 4 },
  primary: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    marginTop: spacing.xl,
  },
  primaryText: { color: colors.background, fontSize: 13, fontWeight: "900" },
  stepTwo: { flex: 1 },
  search: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  teamList: { padding: spacing.lg, gap: 8, paddingBottom: spacing.xl },
  teamOption: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  teamOptionSelected: { borderColor: "#3D8052", backgroundColor: "#1B2E23" },
  teamBadge: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  teamInitial: { color: colors.accent, fontWeight: "900", fontSize: 15 },
  teamCopy: { flex: 1 },
  teamName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  teamOwner: { color: colors.muted, fontSize: 10, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.dim,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  bottomPanel: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  selectionCount: { color: colors.text, fontSize: 13, fontWeight: "800" },
  selectionFoot: { color: colors.muted, fontSize: 10 },
  bottomActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  backButton: {
    width: 78,
    height: 49,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  backText: { color: colors.text, fontWeight: "800" },
  createButton: { flex: 1, marginTop: 0 },
  disabled: { opacity: 0.5 },
  noTeams: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noTeamsTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  noTeamsText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },
  createTeamLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: spacing.md,
    padding: 8,
  },
  createTeamText: { color: colors.accent, fontWeight: "800", fontSize: 12 },
});
