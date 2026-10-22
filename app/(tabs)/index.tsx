import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ChevronRight,
  CircleAlert,
  Plus,
  Search,
  Trophy,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/src/components/AuthGate";
import { ClubMatchdayFooter } from "@/src/components/ClubMatchdayFooter";
import { ClubWelcomeScene } from "@/src/components/ClubWelcomeScene";
import { TeamCrest } from "@/src/components/TeamCrest";
import {
  listTeams,
  listTournaments,
  type TournamentSummary,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { useAppTheme, useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

type Filter = "all" | "active" | "completed" | "mine" | "shared";
const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "mine", label: "Created by me" },
  { id: "shared", label: "Shared with me" },
];

export default function DashboardScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}

function DashboardContent() {
  const { mode: themeMode } = useAppTheme();
  const { session, club, createClub, joinClub } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["tournaments", session?.user.id, club?.id],
    queryFn: () => listTournaments(club?.id ?? ""),
    enabled: Boolean(session && club),
  });
  const teamsQuery = useQuery({
    queryKey: ["teams", session?.user.id, club?.id],
    queryFn: () => listTeams(club?.id ?? "", session?.user.id),
    enabled: Boolean(session && club),
  });
  const tournaments = query.data ?? [];
  const firstName =
    session?.user.user_metadata.full_name?.trim().split(/\s+/)[0] || "Manager";
  const teamCount = teamsQuery.data?.length ?? 0;
  const ownedTournaments = tournaments.filter(
    (tournament) => tournament.owner_id === session?.user.id,
  ).length;
  const visibleTournaments = useMemo(
    () =>
      tournaments.filter((tournament) => {
        const isOwner = tournament.owner_id === session?.user.id;
        const matchesFilter =
          filter === "all" ||
          (filter === "active" && tournament.status === "active") ||
          (filter === "completed" && tournament.status === "completed") ||
          (filter === "mine" && isOwner) ||
          (filter === "shared" && !isOwner);
        return (
          matchesFilter &&
          tournament.name.toLowerCase().includes(search.trim().toLowerCase())
        );
      }),
    [filter, search, session?.user.id, tournaments],
  );

  if (!club) {
    return <ClubSetupScreen createClub={createClub} joinClub={joinClub} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.overline}>YOUR MATCHDAY HQ</Text>
            <Text style={styles.greeting}>Good to see you, {firstName}.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {firstName.slice(0, 1).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={
            themeMode === "dark"
              ? ["#273B2F", "#1C2028", "#1C2028"]
              : ["#E4F2E8", "#FFFFFF", "#FFFFFF"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.heroAtmosphere}>
            <View style={styles.heroGlow} />
            <View style={styles.stadiumLights}>
              <View style={styles.stadiumLight} />
              <View style={styles.stadiumLight} />
              <View style={styles.stadiumLight} />
            </View>
            <View style={styles.pitchOutline}>
              <View style={styles.pitchHalfway} />
              <View style={styles.pitchCircle} />
              <View style={styles.pitchBox} />
            </View>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>THE SEASON STARTS HERE</Text>
            <Text style={styles.heroTitle}>Make every match count.</Text>
            <Text style={styles.heroBody}>
              Set the teams. We’ll take care of the table.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/create-tournament")}
            style={styles.heroButton}
          >
            <Plus color={colors.background} size={18} />
            <Text style={styles.heroButtonText}>New tournament</Text>
          </Pressable>
        </LinearGradient>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stats}
        >
          <Stat label="TOURNAMENTS" value={String(tournaments.length)} />
          <Stat
            label="ACTIVE"
            value={String(
              tournaments.filter((tournament) => tournament.status === "active")
                .length,
            )}
          />
          <Stat
            label="COMPLETED"
            value={String(
              tournaments.filter(
                (tournament) => tournament.status === "completed",
              ).length,
            )}
          />
          <Stat label="CREATED BY YOU" value={String(ownedTournaments)} />
          <Stat label="TEAMS" value={String(teamCount)} />
        </ScrollView>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Your competitions</Text>
            <Text style={styles.sectionMeta}>
              {tournaments.length} tournament
              {tournaments.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/tournaments")}
            style={styles.viewAll}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <ChevronRight color={colors.accent} size={16} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Search color={colors.muted} size={17} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tournaments"
            placeholderTextColor={colors.dim}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[
                styles.filter,
                filter === item.id && styles.filterSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item.id && styles.filterTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {query.isLoading ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Loading your competitions…</Text>
          </View>
        ) : null}
        {query.isError ? (
          <Pressable onPress={() => query.refetch()} style={styles.errorNotice}>
            <CircleAlert color={colors.danger} size={18} />
            <Text style={styles.errorText}>
              Couldn’t load tournaments. Tap to retry.
            </Text>
          </Pressable>
        ) : null}
        {!query.isLoading &&
        !query.isError &&
        visibleTournaments.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Trophy color={colors.accent} size={24} />
            </View>
            <Text style={styles.emptyTitle}>
              {tournaments.length
                ? "No matches for this view"
                : "Your first season starts now"}
            </Text>
            <Text style={styles.emptyBody}>
              {tournaments.length
                ? "Try another filter or search term."
                : "Create a tournament, add your teams, and generate a full home-and-away league."}
            </Text>
            {!tournaments.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/teams")}
                style={styles.emptyAction}
              >
                <Text style={styles.emptyActionText}>Set up teams</Text>
                <ChevronRight color={colors.accent} size={16} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.list}>
          {visibleTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              isOwner={tournament.owner_id === session?.user.id}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ClubSetupScreen({
  createClub,
  joinClub,
}: {
  createClub: (
    name: string,
    pin: string,
  ) => Promise<{ id: string; name: string; pin: string }>;
  joinClub: (
    name: string,
    pin: string,
  ) => Promise<{ id: string; name: string; pin: string }>;
}) {
  const { mode: themeMode } = useAppTheme();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [clubName, setClubName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!mode) return;
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createClub(clubName, pin);
      } else {
        await joinClub(clubName, pin);
      }
      setClubName("");
      setPin("");
      setTimeout(() => {
        router.replace("/(tabs)/tournaments");
      }, 0);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Club details could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.setupContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.setupGreetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.setupOverline}>WELCOME IN</Text>
            <Text style={styles.setupGreeting}>Pick your Club to start.</Text>
          </View>
        </View>

        <ClubWelcomeScene />

        <LinearGradient
          colors={
            themeMode === "dark"
              ? ["#273B2F", "#1C2028", "#1C2028"]
              : ["#E4F2E8", "#FFFFFF", "#FFFFFF"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.setupHero}
        >
          <View style={styles.heroText}>
            <Text style={styles.setupHeroLabel}>FIRST THINGS FIRST</Text>
            <Text style={styles.setupHeroTitle}>
              Create a Club or join an existing one.
            </Text>
            <Text style={styles.setupHeroBody}>
              Set the club name and a 6-digit PIN so your group can share
              tournaments and teams.
            </Text>
          </View>
        </LinearGradient>

        {!mode ? (
          <>
            <View style={styles.setupClubActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode("create")}
                style={[styles.setupHeroButton, styles.clubActionButton]}
              >
                <Plus color={colors.background} size={16} />
                <Text style={styles.heroButtonText}>Create Club</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode("join")}
                style={[styles.setupSecondaryAction, styles.clubActionButton]}
              >
                <Text style={styles.secondaryActionText}>Join with PIN</Text>
              </Pressable>
            </View>
            <ClubMatchdayFooter />
          </>
        ) : (
          <View style={styles.clubForm}>
            <Text style={styles.formTitle}>
              {mode === "create" ? "Create your Club" : "Enter your Club"}
            </Text>
            <TextInput
              value={clubName}
              onChangeText={setClubName}
              placeholder="Club name"
              placeholderTextColor={colors.dim}
              style={styles.input}
              autoCapitalize="words"
            />
            <TextInput
              value={pin}
              onChangeText={(value) =>
                setPin(value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6-digit PIN"
              placeholderTextColor={colors.dim}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.input}
            />
            {error ? <Text style={styles.formError}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={isSubmitting || !clubName.trim() || pin.length !== 6}
              style={[
                styles.heroButton,
                styles.clubActionButton,
                (isSubmitting || !clubName.trim() || pin.length !== 6) &&
                  styles.heroButtonDisabled,
              ]}
            >
              <Text style={styles.heroButtonText}>
                {isSubmitting
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Club"
                    : "Join Club"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode(null);
                setClubName("");
                setPin("");
                setError("");
              }}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>Back</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TournamentCard({
  tournament,
  isOwner,
}: {
  tournament: TournamentSummary;
  isOwner: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/tournament/[id]",
          params: { id: tournament.id },
        })
      }
      style={({ pressed }) => [
        styles.card,
        tournament.status === "active" && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.cardAtmosphere,
          tournament.status === "completed" && styles.cardAtmosphereComplete,
        ]}
      />
      <View style={styles.cardTop}>
        <View
          style={[
            styles.statusDot,
            tournament.status === "completed" && styles.statusDotComplete,
          ]}
        />
        <Text style={styles.statusText}>
          {tournament.status === "active" ? "ACTIVE" : "COMPLETED"}
        </Text>
        <Text style={styles.cardDate}>
          {new Date(tournament.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {tournament.name}
      </Text>
      <Text style={styles.ownership}>
        {isOwner ? "CREATED BY YOU" : "SHARED WITH YOU"}
      </Text>
      <View style={styles.cardBottom}>
        <View style={styles.crestGroup}>
          {tournament.teams.slice(0, 4).map((team, index) => (
            <TeamCrest
              key={team.id}
              name={team.name}
              logoPath={team.logo_path}
              size={27}
              style={{
                marginLeft: index === 0 ? 0 : -7,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            />
          ))}
          {tournament.teams.length > 4 ? (
            <Text style={styles.moreTeams}>+{tournament.teams.length - 4}</Text>
          ) : null}
        </View>
        <Text style={styles.teamCount}>{tournament.teams.length} teams</Text>
        <ChevronRight color={colors.dim} size={17} />
      </View>
    </Pressable>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  setupContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  setupGreetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  setupOverline: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 2,
  },
  setupGreeting: { color: colors.text, fontSize: 18, fontWeight: "900" },
  setupHero: {
    position: "relative",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  setupHeroLabel: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  setupHeroTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    marginBottom: 2,
  },
  setupHeroBody: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  setupClubActions: {
    marginTop: spacing.sm,
    gap: 7,
  },
  setupHeroButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: spacing.md,
    gap: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  setupSecondaryAction: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  greetingCopy: { flex: 1, paddingRight: spacing.md },
  overline: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  greeting: { color: colors.text, fontSize: 24, fontWeight: "900" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: { color: colors.accent, fontSize: 16, fontWeight: "900" },
  hero: {
    position: "relative",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.xl,
    overflow: "hidden",
  },
  heroAtmosphere: {
    ...StyleSheet.absoluteFill,
  },
  heroGlow: {
    position: "absolute",
    top: -58,
    right: -24,
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.accent,
    opacity: 0.12,
  },
  stadiumLights: {
    position: "absolute",
    top: 16,
    right: 18,
    flexDirection: "row",
    gap: 6,
  },
  stadiumLight: {
    width: 18,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    opacity: 0.32,
  },
  pitchOutline: {
    position: "absolute",
    right: -34,
    bottom: -36,
    width: 174,
    height: 112,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 48,
    opacity: 0.16,
    overflow: "hidden",
  },
  pitchHalfway: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.text,
  },
  pitchCircle: {
    position: "absolute",
    width: 46,
    height: 46,
    left: "50%",
    top: "50%",
    marginLeft: -23,
    marginTop: -23,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: radii.pill,
  },
  pitchBox: {
    position: "absolute",
    right: 0,
    top: 28,
    width: 28,
    height: 54,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.text,
  },
  heroText: { maxWidth: 390 },
  heroLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroBody: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  heroButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  heroButtonDisabled: {
    opacity: 0.45,
  },
  heroButtonText: { color: colors.background, fontWeight: "900", fontSize: 13 },
  clubActions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  clubActionButton: {
    alignSelf: "stretch",
    width: "100%",
    marginTop: 0,
  },
  secondaryAction: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  secondaryActionText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  clubForm: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  input: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  formError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  backLink: {
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  backLinkText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: { width: 105, alignItems: "flex-start", gap: 5 },
  statValue: { color: colors.text, fontFamily: "SpaceMono", fontSize: 20 },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  sectionMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 1, padding: 6 },
  viewAllText: { color: colors.accent, fontWeight: "800", fontSize: 12 },
  searchBox: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterRow: { gap: 8, paddingVertical: spacing.md },
  filter: {
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterSelected: { backgroundColor: "#22362A", borderColor: "#3D8052" },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  filterTextSelected: { color: colors.accent },
  list: { gap: 10 },
  card: {
    position: "relative",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardActive: { borderColor: colors.accent },
  cardPressed: { opacity: 0.84 },
  cardAtmosphere: {
    position: "absolute",
    top: -48,
    right: -60,
    width: 144,
    height: 112,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    opacity: 0.055,
  },
  cardAtmosphereComplete: {
    backgroundColor: colors.gold,
    opacity: 0.07,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 11,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  statusDotComplete: { backgroundColor: colors.gold },
  statusText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  ownership: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: -10,
    marginBottom: spacing.md,
  },
  cardDate: { marginLeft: "auto", color: colors.dim, fontSize: 11 },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  crestGroup: { flexDirection: "row", alignItems: "center", marginRight: 4 },
  crest: {
    width: 27,
    height: 27,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  crestText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  moreTeams: { color: colors.muted, fontSize: 10, marginLeft: 5 },
  teamCount: { flex: 1, color: colors.muted, fontSize: 12 },
  notice: { paddingVertical: spacing.xl, alignItems: "center" },
  noticeText: { color: colors.muted, fontSize: 13 },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#21372B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 310,
  },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    gap: 4,
  },
  emptyActionText: { color: colors.accent, fontSize: 13, fontWeight: "800" },
});
