import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Crown,
  ImagePlus,
  Medal,
  RefreshCw,
  Lock,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Table2,
  Trash2,
  Trophy,
  X,
} from "lucide-react-native";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
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
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/src/components/AuthGate";
import { StadiumScene } from "@/src/components/StadiumScene";
import { TeamCrest } from "@/src/components/TeamCrest";
import {
  assessFinalEligibility,
  resolveFinalWinner,
} from "@/src/features/finals/rules";
import { calculateStandings } from "@/src/features/standings/calculateStandings";
import { ShareSheet } from "@/src/features/tournaments/ShareSheet";
import {
  addTournamentTeams,
  createFinal,
  listTeams,
  type TeamRecord,
  deleteTournamentFixture,
  generateFixtures,
  getSignedMatchNoteUrl,
  getTournament,
  listActivity,
  removeMatchNoteImage,
  removeTournamentTeam,
  saveFixtureResult,
  subscribeToTournament,
  type GoalEventInput,
  type TournamentFixture,
} from "@/src/features/tournaments/api";
import { getLogoFileType } from "@/src/features/tournaments/logoFile";
import { useAuth } from "@/src/lib/auth";
import { supabase, supabaseConfigured } from "@/src/lib/supabase";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

type Section =
  | "overview"
  | "fixtures"
  | "table"
  | "teams"
  | "final"
  | "activity";
type Confirmation =
  | "fixtures"
  | "final"
  | { kind: "deleteFixture"; fixture: TournamentFixture }
  | { kind: "removeTeam"; team: { id: string; name: string } };
type GoalCelebrationState = {
  teamName: string;
  matchup: string;
  score: string;
};
const sections: Array<{ id: Section; title: string }> = [
  { id: "overview", title: "Overview" },
  { id: "fixtures", title: "Fixtures" },
  { id: "table", title: "Table" },
  { id: "teams", title: "Teams" },
  { id: "activity", title: "Activity" },
];
const maxMatchNoteImageBytes = 5 * 1024 * 1024;

export default function TournamentScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <TournamentContent />
    </AuthGate>
  );
}

function TournamentContent() {
  const params = useLocalSearchParams<{ id: string | string[]; fixtureId?: string }>();
  const tournamentId = useMemo(() => {
    const raw = params.id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    if (typeof raw === "string") return raw;
    return "";
  }, [params.id]);
  const fixtureId =
    typeof params.fixtureId === "string" ? params.fixtureId : "";
  const { session, club } = useAuth();
  const [addTeamsVisible, setAddTeamsVisible] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [selectedFixture, setSelectedFixture] =
    useState<TournamentFixture | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [goalCelebration, setGoalCelebration] =
    useState<GoalCelebrationState | null>(null);
  const sectionTouchStart = useRef<{ x: number; y: number } | null>(null);
  const openedFixtureId = useRef<string | null>(null);
  const scoreSnapshot = useRef<{
    tournamentId: string;
    scores: Map<
      string,
      { status: TournamentFixture["status"]; home: number | null; away: number | null }
    >;
  } | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId),
    enabled: Boolean(tournamentId),
  });
  const activityQuery = useQuery({
    queryKey: ["activity", tournamentId],
    queryFn: () => listActivity(tournamentId),
    enabled: Boolean(tournamentId) && section === "activity",
  });
  const data = query.data;
  const isOwner = data?.tournament.owner_id === session?.user.id;
  const tournamentState: "not_started" | "active" | "completed" = useMemo(() => {
    if (data?.tournament.status === "completed") return "completed";
    const finalFixture = data?.fixtures.find((f) => f.stage === "final");
    if (finalFixture?.status === "played") return "completed";
    if (data?.fixtures && data.fixtures.length > 0) return "active";
    return "not_started";
  }, [data]);
  const clubId = (data?.tournament as any)?.club_id ?? club?.id ?? "";
  const clubTeamsQuery = useQuery({
    queryKey: ["teams", session?.user.id, clubId],
    queryFn: () => listTeams(clubId),
    enabled: Boolean(clubId && isOwner),
  });
  const existingTeamIds = useMemo(
    () => new Set(data?.teams.map((t) => t.id) ?? []),
    [data?.teams],
  );
  const canEditFixtures = Boolean(
    isOwner && data?.tournament.status !== "completed",
  );
  const leagueFixtures =
    data?.fixtures.filter((fixture) => fixture.stage === "league") ?? [];
  const table = useMemo(
    () =>
      data
        ? calculateStandings(
            data.teams,
            data.fixtures.map((fixture) => ({
              id: fixture.id,
              stage: fixture.stage,
              status: fixture.status,
              roundNumber: fixture.matchdays?.round_number ?? 0,
              homeTeamId: fixture.home_team_id,
              awayTeamId: fixture.away_team_id,
              homeScore: fixture.home_score,
              awayScore: fixture.away_score,
              playedAt: fixture.played_at ?? fixture.updated_at,
            })),
          )
        : [],
    [data],
  );
  const completedLeague = leagueFixtures.filter(
    (fixture) => fixture.status === "played",
  ).length;
  const finalEligibility = assessFinalEligibility(data?.fixtures ?? []);
  const pendingLeague = finalEligibility.remainingLeagueMatches;
  const finalFixture = data?.fixtures.find(
    (fixture) => fixture.stage === "final",
  );
  const visibleSections = finalFixture
    ? [...sections, { id: "final" as const, title: "Final" }]
    : sections;
  const selectSection = (nextSection: Section) => {
    if (selectedFixture) {
      setSelectedFixture(null);
      resultMutation.reset();
    }
    setSection(nextSection);
  };
  const handleSectionSwipe: NonNullable<
    ComponentProps<typeof ScrollView>["onTouchEnd"]
  > = (event) => {
    const touch = event.nativeEvent.changedTouches[0];
    const start = sectionTouchStart.current;
    sectionTouchStart.current = null;
    if (!touch || !start || selectedFixture || section === "table") return;
    const deltaX = touch.pageX - start.x;
    const deltaY = touch.pageY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) {
      return;
    }
    const currentIndex = visibleSections.findIndex(
      (item) => item.id === section,
    );
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    const nextSection = visibleSections[nextIndex];
    if (nextSection) selectSection(nextSection.id);
  };
  const championId = resolveFinalWinner(finalFixture);

  useEffect(() => {
    if (!tournamentId || !supabaseConfigured) return;
    return subscribeToTournament(tournamentId, () => {
      void queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    });
  }, [queryClient, tournamentId]);

  useEffect(() => {
    scoreSnapshot.current = null;
    setGoalCelebration(null);
  }, [tournamentId]);

  useEffect(() => {
    if (!data) return;
    const previous =
      scoreSnapshot.current?.tournamentId === tournamentId
        ? scoreSnapshot.current.scores
        : null;
    const scores = new Map(
      data.fixtures.map((fixture) => [
        fixture.id,
        {
          status: fixture.status,
          home: fixture.home_score,
          away: fixture.away_score,
        },
      ]),
    );
    scoreSnapshot.current = { tournamentId, scores };
    if (!previous) return;

    const changedFixture = data.fixtures.find((fixture) => {
      const oldScore = previous.get(fixture.id);
      return (
        fixture.status === "played" &&
        oldScore !== undefined &&
        ((fixture.home_score ?? 0) > (oldScore.home ?? 0) ||
          (fixture.away_score ?? 0) > (oldScore.away ?? 0))
      );
    });
    if (!changedFixture) return;

    const oldScore = previous.get(changedFixture.id);
    if (!oldScore) return;
    const homeAdded =
      (changedFixture.home_score ?? 0) > (oldScore.home ?? 0);
    const awayAdded =
      (changedFixture.away_score ?? 0) > (oldScore.away ?? 0);
    const homeTeam = data.teams.find(
      (team) => team.id === changedFixture.home_team_id,
    );
    const awayTeam = data.teams.find(
      (team) => team.id === changedFixture.away_team_id,
    );
    if (!homeTeam || !awayTeam) return;
    const scoringTeamName =
      homeAdded && awayAdded
        ? `${homeTeam.name} & ${awayTeam.name}`
        : homeAdded
          ? homeTeam.name
          : awayTeam.name;
    setGoalCelebration({
      teamName: scoringTeamName,
      matchup: `${homeTeam.name} vs ${awayTeam.name}`,
      score: `${changedFixture.home_score ?? 0} - ${changedFixture.away_score ?? 0}`,
    });
  }, [data, tournamentId]);

  useEffect(() => {
    if (!goalCelebration) return;
    const timeout = setTimeout(() => setGoalCelebration(null), 2800);
    return () => clearTimeout(timeout);
  }, [goalCelebration]);

  useEffect(() => {
    if (!fixtureId || !data || openedFixtureId.current === fixtureId) return;
    const fixture = data.fixtures.find((item) => item.id === fixtureId);
    if (!fixture) return;
    openedFixtureId.current = fixtureId;
    setSection("fixtures");
    setSelectedFixture(fixture);
  }, [data, fixtureId]);

  const addTeamsMutation = useMutation({
    mutationFn: (teamIds: string[]) => addTournamentTeams(tournamentId, teamIds),
    onSuccess: async () => {

      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });
      setAddTeamsVisible(false);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateFixtures(
        tournamentId,
        data?.teams.map(({ id, name }) => ({ id, name })) ?? [],
      ),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setSection("fixtures");
    },
  });
  /* discard
      ),





      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });
    },
  });
  */
  const finalMutation = useMutation({
    mutationFn: () => createFinal(tournamentId),
    onSuccess: async () => {

      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });

    },
  });
  const resultMutation = useMutation({
    mutationFn: async ({
      imageAsset,
      previousNotesImagePath,
      ...input
    }: Parameters<typeof saveFixtureResult>[0] & {
      imageAsset: ImagePicker.ImagePickerAsset | null;
      previousNotesImagePath: string | null;
    }) => {
      let uploadedPath: string | null = null;
      if (imageAsset) {
        if (!supabase || !session) {
          throw new Error("Your session is no longer available. Sign in again.");
        }
        const imageFile = new File(imageAsset.uri);
        if (imageFile.size > maxMatchNoteImageBytes) {
          throw new Error("Match photos must be 5 MB or smaller.");
        }
        const imageBytes = new Uint8Array(await imageFile.arrayBuffer());
        if (imageBytes.byteLength > maxMatchNoteImageBytes) {
          throw new Error("Match photos must be 5 MB or smaller.");
        }
        const { mimeType, extension } = getLogoFileType(imageBytes);
        uploadedPath =
          `${session.user.id}/${input.fixtureId}/` +
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
        const { error } = await supabase.storage
          .from("match-notes")
          .upload(uploadedPath, imageBytes, {
            contentType: mimeType,
            upsert: false,
          });
        if (error) throw error;
      }

      let saved: Awaited<ReturnType<typeof saveFixtureResult>>;
      try {
        saved = await saveFixtureResult({
          ...input,
          notesImagePath: imageAsset ? uploadedPath : input.notesImagePath,
        });
      } catch (saveError) {
        if (uploadedPath) {
          try {
            await removeMatchNoteImage(uploadedPath);
          } catch (cleanupError) {
            const saveMessage =
              saveError instanceof Error
                ? saveError.message
                : "Could not save the match result.";
            const cleanupMessage =
              cleanupError instanceof Error
                ? cleanupError.message
                : "Could not remove the uploaded photo.";
            throw new Error(`${saveMessage} ${cleanupMessage}`);
          }
        }
        throw saveError;
      }

      let cleanupError: string | null = null;
      if (
        previousNotesImagePath &&
        previousNotesImagePath !== saved.notes_image_path
      ) {
        try {
          await removeMatchNoteImage(previousNotesImagePath);
        } catch (error) {
          cleanupError =
            error instanceof Error ? error.message : "Could not delete photo.";
        }
      }
      return { saved, cleanupError };
    },
    onSuccess: async ({ saved, cleanupError }) => {
      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.refetchQueries({ queryKey: ["tournaments"] });
      if (cleanupError) {
        Alert.alert(
          "Match saved",
          `The previous photo could not be deleted: ${cleanupError}`,
        );
      }
      setSelectedFixture(null);
      if (
        saved.stage === "final" &&
        saved.status === "played" &&
        saved.home_score !== saved.away_score
      ) {
        router.push({
          pathname: "/tournament/[id]/champion",
          params: { id: tournamentId },
        });
      }
    },
  });
  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => removeTournamentTeam(tournamentId, teamId),
    onSuccess: async () => {

      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.refetchQueries({ queryKey: ["tournaments"] });
      setConfirmation(null);
      setSelectedFixture(null);
    },
  });
  const deleteFixtureMutation = useMutation({
    mutationFn: (fixtureId: string) => deleteTournamentFixture(fixtureId),
    onSuccess: async () => {

      await queryClient.refetchQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.refetchQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.refetchQueries({ queryKey: ["tournaments"] });
      setConfirmation(null);
      setSelectedFixture(null);
    },
  });

  const onGenerate = () => {
    if (!data) return;
    setConfirmation("fixtures");
  };
  const onCreateFinal = () => setConfirmation("final");
  const confirmAction = () => {
    if (confirmation === "fixtures") generateMutation.mutate();
    if (confirmation === "final") finalMutation.mutate();
    if (confirmation === "fixtures" || confirmation === "final") {
      setConfirmation(null);
    } else if (confirmation?.kind === "removeTeam") {
      removeTeamMutation.mutate(confirmation.team.id);
    } else if (confirmation?.kind === "deleteFixture") {
      deleteFixtureMutation.mutate(confirmation.fixture.id);
    }
  };

  if (query.isPending || (!data && !query.isError))
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading tournament…</Text>
      </SafeAreaView>
    );
    /*
          */}
        </>
      ) : null}
    </SafeAreaView>
    );
    */
  if (query.isError || !data)
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <CircleAlert color={colors.danger} size={22} />
        <Text style={styles.muted}>Couldn’t load this tournament.</Text>
        {query.error?.message ? (
          <Text style={[styles.error, { textAlign: "center", marginHorizontal: spacing.xl, marginTop: 8 }]}>
            {query.error.message}
          </Text>
        ) : null}
        <Pressable onPress={() => query.refetch()}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
    /*
        </Pressable>
          */}
        </>
      ) : null}
    </SafeAreaView>
    );
    */
  const teamById = new Map(data.teams.map((team) => [team.id, team]));

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color={colors.text} size={19} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>TOURNAMENT WORKSPACE</Text>
          <Text style={styles.tournamentTitle} numberOfLines={1}>
            {data.tournament.name}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,

            tournamentState === "not_started" && styles.statusBadgeNotStarted,
            tournamentState === "active" && styles.statusBadgeActive,
            tournamentState === "completed" && styles.statusBadgeComplete,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              tournamentState === "not_started" && styles.statusTextNotStarted,
              tournamentState === "active" && styles.statusTextActive,
              tournamentState === "completed" && styles.statusTextComplete,
            ]}
          >
            {tournamentState === "not_started"
              ? "NOT STARTED"
              : tournamentState === "active"
                ? "ACTIVE"
                : "COMPLETED"}
          </Text>
        </View>
        {isOwner ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share tournament"
            onPress={() => setShareVisible(true)}
            style={styles.back}
          >
            <Share2 color={colors.accent} size={18} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{data.teams.length}</Text>
          <Text style={styles.summaryLabel}>TEAMS</Text>
        </View>
        <View style={styles.summaryLine} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {completedLeague}
            <Text style={styles.summaryTotal}>/{leagueFixtures.length}</Text>
          </Text>
          <Text style={styles.summaryLabel}>PLAYED</Text>
        </View>
        <View style={styles.summaryLine} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{pendingLeague}</Text>
          <Text style={styles.summaryLabel}>REMAINING</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        style={styles.sectionNavigation}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {visibleSections.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => selectSection(item.id)}
            style={[styles.tab, section === item.id && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                section === item.id && styles.tabTextActive,
              ]}
            >
              {item.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        onTouchStart={(event) => {
          const touch = event.nativeEvent.touches[0];
          sectionTouchStart.current = touch
            ? { x: touch.pageX, y: touch.pageY }
            : null;
        }}
        onTouchEnd={handleSectionSwipe}
      >
        {selectedFixture ? (
          <ResultModal
            fixture={selectedFixture}
            teamById={teamById}
            canEdit={canEditFixtures}
            busy={resultMutation.isPending}
            error={resultMutation.error?.message}
            onClose={() => {
              setSelectedFixture(null);
              resultMutation.reset();
            }}
            onSave={(input) => resultMutation.mutate(input)}
          />
        ) : (
          <>
            {section === "overview" ? (
              <Overview
                data={data}
                completed={completedLeague}
                pending={pendingLeague}
                table={table}
                isOwner={Boolean(isOwner)}
                onGenerate={onGenerate}
                generating={generateMutation.isPending}
              />
            ) : null}
            {section === "fixtures" ? (
              <Fixtures
                fixtures={data.fixtures}
                teamById={teamById}
                canEdit={canEditFixtures}
                onSelect={setSelectedFixture}
                onDelete={(fixture) => {
                  deleteFixtureMutation.reset();
                  setConfirmation({ kind: "deleteFixture", fixture })
                }}
              />
            ) : null}
            {section === "final" && finalFixture ? (
              <FinalSection
                fixture={finalFixture}
                teamById={teamById}
                isOwner={Boolean(isOwner)}
                canEdit={canEditFixtures}
                championId={championId}
                onOpenFixture={setSelectedFixture}
                onDelete={(fixture) => {
                  deleteFixtureMutation.reset();
                  setConfirmation({ kind: "deleteFixture", fixture })
                }}
                onViewChampion={() =>
                  router.push({
                    pathname: "/tournament/[id]/champion",
                    params: { id: tournamentId },
                  })
                }
              />
            ) : null}
            {section === "table" ? (
              <TableSection
                table={table}
                pending={pendingLeague}
                hasFixtures={leagueFixtures.length > 0}
                canCreateFinal={finalEligibility.eligible}
                finalFixture={finalFixture}
                championId={championId}
                isOwner={Boolean(isOwner)}
                teamById={teamById}
                onCreateFinal={onCreateFinal}
                creatingFinal={finalMutation.isPending}
                onViewChampion={() =>
                  router.push({
                    pathname: "/tournament/[id]/champion",
                    params: { id: tournamentId },
                  })
                }
              />
            ) : null}
            {section === "teams" ? (
              <TournamentTeams
                teams={data.teams}
                isOwner={Boolean(isOwner)}
                canRemove={canEditFixtures && tournamentState === "not_started"}
                tournamentState={tournamentState}
                onOpenAddTeams={() => setAddTeamsVisible(true)}
                completed={data.tournament.status === "completed"}
                onRemove={(team) => {
                  removeTeamMutation.reset();
                  if (tournamentState !== "not_started") {
                    Alert.alert(
                      "Teams Locked",
                      tournamentState === "active"
                        ? "Cannot remove teams while tournament fixtures are active."
                        : "Cannot remove teams from a completed tournament.",
                    );
                    return;
                  }
                  setConfirmation({ kind: "removeTeam", team });
                }}
              />
            ) : null}
            {section === "activity" ? (
              <ActivityFeed
                activity={activityQuery.data ?? []}
                loading={activityQuery.isLoading}
                error={activityQuery.isError}
                onRetry={() => activityQuery.refetch()}
              />
            ) : null}
            {generateMutation.error ? (
              <Text style={styles.error}>{generateMutation.error.message}</Text>
            ) : null}
            {finalMutation.error ? (
              <Text style={styles.error}>{finalMutation.error.message}</Text>
            ) : null}
            {resultMutation.error ? (
              <Text style={styles.error}>{resultMutation.error.message}</Text>
            ) : null}
          </>
        )}
      </ScrollView>
      {goalCelebration ? (
        <GoalCelebration
          teamName={goalCelebration.teamName}
          matchup={goalCelebration.matchup}
          score={goalCelebration.score}
          onDismiss={() => setGoalCelebration(null)}
        />
      ) : null}
      <Modal
        visible={confirmation !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (
            !removeTeamMutation.isPending &&
            !deleteFixtureMutation.isPending &&
            !generateMutation.isPending &&
            !finalMutation.isPending
          ) {
            setConfirmation(null);
          }
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>
              {confirmation === "fixtures"
                ? "Generate league fixtures?"
                : confirmation === "final"
                  ? "Create the final?"
                  : confirmation?.kind === "removeTeam"
                    ? "Remove team from tournament?"
                    : "Delete fixture?"}
            </Text>
            <Text style={styles.confirmBody}>
              {confirmation === "fixtures"
                ? `${data.teams.length * (data.teams.length - 1)} matches will be generated. Every team plays each opponent home and away.`
                : confirmation === "final"
                  ? `${table[0]?.name ?? "First place"} and ${table[1]?.name ?? "Second place"} will play for the championship.`
                  : confirmation?.kind === "removeTeam"
                    ? `Remove ${confirmation.team.name} from this tournament? The team will remain in your club roster.`
                    : confirmation?.kind === "deleteFixture"
                      ? `Delete this ${confirmation.fixture.stage === "final" ? "final" : "league"} fixture and its result? This cannot be undone.`
                      : ""}
            </Text>
            {removeTeamMutation.error || deleteFixtureMutation.error ? (
              <Text style={styles.error}>
                {
                  (removeTeamMutation.error ?? deleteFixtureMutation.error)
                    ?.message
                }
              </Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                disabled={
                  removeTeamMutation.isPending ||
                  deleteFixtureMutation.isPending ||
                  generateMutation.isPending ||
                  finalMutation.isPending
                }
                onPress={() => setConfirmation(null)}
                style={styles.confirmCancel}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={
                  generateMutation.isPending ||
                  finalMutation.isPending ||
                  removeTeamMutation.isPending ||
                  deleteFixtureMutation.isPending
                }
                onPress={confirmAction}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmButtonText}>
                  {generateMutation.isPending ||
                  finalMutation.isPending ||
                  removeTeamMutation.isPending ||
                  deleteFixtureMutation.isPending
                    ? "Working…"
                    : confirmation === "fixtures"
                      ? "Generate"
                      : confirmation === "final"
                        ? "Create final"
                        : confirmation?.kind === "removeTeam"
                          ? "Remove team"
                          : "Delete fixture"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {isOwner ? (
        <>
          <ShareSheet
          tournamentId={tournamentId}
          tournamentName={data.tournament.name}
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
        />
        <AddTeamsModal
          visible={addTeamsVisible}
          onClose={() => setAddTeamsVisible(false)}
          onAdd={(teamIds) => addTeamsMutation.mutate(teamIds)}
          isPending={addTeamsMutation.isPending}
          clubTeams={clubTeamsQuery.data ?? []}
          existingTeamIds={existingTeamIds}
          tournamentName={data.tournament.name}
        />
        {/*
        />
      ) : null}
        */}
        </>
      ) : null}
    </SafeAreaView>
  );
}

function Overview({
  data,
  completed,
  pending,
  table,
  isOwner,
  onGenerate,
  generating,
}: {
  data: Awaited<ReturnType<typeof getTournament>>;
  completed: number;
  pending: number;
  table: ReturnType<typeof calculateStandings>;
  isOwner: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  const latest = [...data.fixtures]
    .filter((fixture) => fixture.status === "played")
    .sort((a, b) =>
      (b.played_at ?? b.updated_at).localeCompare(a.played_at ?? a.updated_at),
    )
    .slice(0, 2);
  const upcoming = [...data.fixtures]
    .filter(
      (fixture) => fixture.status === "pending" && fixture.stage === "league",
    )
    .sort(
      (a, b) =>
        (a.matchdays?.round_number ?? 0) - (b.matchdays?.round_number ?? 0),
    )
    .slice(0, 2);
  const teams = new Map(data.teams.map((team) => [team.id, team.name]));
  return (
    <View>
      <StadiumScene />
      <View style={styles.panelHeading}>
        <Text style={styles.sectionTitle}>Season snapshot</Text>
        <Text style={styles.panelMeta}>
          {data.tournament.start_date
            ? new Date(
                `${data.tournament.start_date}T12:00:00`,
              ).toLocaleDateString()
            : "Dates TBD"}
        </Text>
      </View>
      <View style={styles.progressPanel}>
        <View style={styles.progressTop}>
          <Text style={styles.progressLabel}>LEAGUE PROGRESS</Text>
          <Text style={styles.progressNumber}>
            {completed} / {completed + pending}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${completed + pending === 0 ? 0 : (completed / (completed + pending)) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressCaption}>
          {pending
            ? `${pending} league matches still to play`
            : completed
              ? "League stage complete"
              : "No fixtures generated yet"}
        </Text>
      </View>
      {table.length && data.fixtures.length ? (
        <View style={styles.leaderPanel}>
          <View style={styles.leaderIcon}>
            <Medal color={colors.gold} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelMeta}>CURRENT LEAGUE LEADER</Text>
            <Text style={styles.leaderName}>{table[0]?.name ?? "—"}</Text>
          </View>
          <Text style={styles.leaderPoints}>
            {table[0]?.points ?? 0}
            <Text style={styles.pts}> PTS</Text>
          </Text>
        </View>
      ) : null}
      {upcoming.length ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Up next</Text>
          {upcoming.map((fixture) => (
            <MiniMatch
              key={fixture.id}
              fixture={fixture}
              home={teams.get(fixture.home_team_id) ?? "Home"}
              away={teams.get(fixture.away_team_id) ?? "Away"}
            />
          ))}
        </View>
      ) : null}
      {latest.length ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Latest results</Text>
          {latest.map((fixture) => (
            <MiniMatch
              key={fixture.id}
              fixture={fixture}
              home={teams.get(fixture.home_team_id) ?? "Home"}
              away={teams.get(fixture.away_team_id) ?? "Away"}
            />
          ))}
        </View>
      ) : null}
      {isOwner && data.fixtures.length === 0 ? (
        <ActionBanner
          title={data.teams.length < 2 ? "Add teams to schedule" : "The league is ready to schedule"}
          body={data.teams.length < 2 ? "Add at least 2 teams in the Teams tab before generating league fixtures." : "Generate the complete home-and-away fixture list."}
          action={data.teams.length < 2 ? "Need 2+ teams" : "Generate fixtures"}
          busy={generating}
          onPress={data.teams.length < 2 ? () => Alert.alert("Teams Required", "Please add at least 2 teams in the Teams tab before generating fixtures.") : onGenerate}
        />
      ) : null}
      {data.fixtures.find((fixture) => fixture.stage === "final")?.status ===
      "played" ? (
        <View style={styles.championStrip}>
          <Crown color={colors.gold} size={18} />
          <Text style={styles.championStripText}>
            Final played · open the Table to view the champion
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MiniMatch({
  fixture,
  home,
  away,
}: {
  fixture: TournamentFixture;
  home: string;
  away: string;
}) {
  return (
    <View style={styles.miniMatch}>
      <Text style={styles.miniTeam} numberOfLines={1}>
        {home}
      </Text>
      <Text style={styles.miniScore}>
        {fixture.status === "played"
          ? `${fixture.home_score} : ${fixture.away_score}`
          : "VS"}
      </Text>
      <Text style={[styles.miniTeam, styles.awayTeam]} numberOfLines={1}>
        {away}
      </Text>
    </View>
  );
}

function ActionBanner({
  title,
  body,
  action,
  busy,
  onPress,
}: {
  title: string;
  body: string;
  action: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.actionBanner}>
      <View style={styles.actionIcon}>
        <CalendarClock color={colors.accent} size={18} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionBody}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onPress}
        style={styles.actionButton}
      >
        {busy ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Text style={styles.actionButtonText}>{action}</Text>
            <ChevronRight color={colors.background} size={17} />
          </>
        )}
      </Pressable>
    </View>
  );
}

function GoalCelebration({
  teamName,
  matchup,
  score,
  onDismiss,
}: GoalCelebrationState & { onDismiss: () => void }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(1, { damping: 18, stiffness: 180 });
    return () => cancelAnimation(progress);
  }, [progress]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-14, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
    ],
  }));

  return (
    <View pointerEvents="box-none" style={styles.goalOverlay}>
      <Animated.View
        accessibilityLiveRegion="assertive"
        style={[styles.goalToast, revealStyle]}
      >
        <View style={styles.goalAccent} />
        <View style={styles.goalCopy}>
          <Text style={styles.goalKicker}>GOAL</Text>
          <Text style={styles.goalTeam} numberOfLines={1}>
            {teamName}
          </Text>
          <Text style={styles.goalMatch} numberOfLines={1}>
            {matchup} · {score}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss goal celebration"
          onPress={onDismiss}
          style={styles.goalDismiss}
        >
          <X color={colors.text} size={17} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Fixtures({
  fixtures,
  teamById,
  canEdit,
  onSelect,
  onDelete,
}: {
  fixtures: TournamentFixture[];
  teamById: Map<string, { id: string; name: string; logo_path: string | null }>;
  canEdit: boolean;
  onSelect: (fixture: TournamentFixture) => void;
  onDelete: (fixture: TournamentFixture) => void;
}) {
  if (!fixtures.length)
    return (
      <View style={styles.empty}>
        <CalendarClock color={colors.accent} size={22} />
        <Text style={styles.emptyTitle}>No fixtures yet</Text>
        <Text style={styles.emptyBody}>
          {canEdit
            ? "Generate fixtures from the Overview tab to get the season underway."
            : "The tournament owner has not generated the schedule yet."}
        </Text>
      </View>
    );
  const rounds = new Map<number, TournamentFixture[]>();
  const finals = fixtures.filter((fixture) => fixture.stage === "final");
  const leagueFixtures = fixtures
    .filter((item) => item.stage === "league")
    .sort((a, b) => {
      const roundA = a.matchdays?.round_number ?? 0;
      const roundB = b.matchdays?.round_number ?? 0;
      if (roundA !== roundB) return roundA - roundB;
      if (a.scheduled_at && b.scheduled_at) {
        return a.scheduled_at.localeCompare(b.scheduled_at);
      }
      return a.id.localeCompare(b.id);
    });
  const fixturesByPair = new Map<string, TournamentFixture[]>();
  for (const fixture of leagueFixtures) {
    const round = fixture.matchdays?.round_number ?? 0;
    rounds.set(round, [...(rounds.get(round) ?? []), fixture]);
    const pairKey = [fixture.home_team_id, fixture.away_team_id]
      .sort()
      .join(":");
    fixturesByPair.set(pairKey, [
      ...(fixturesByPair.get(pairKey) ?? []),
      fixture,
    ]);
  }
  const legsByFixture = new Map<string, 1 | 2>();
  for (const pair of fixturesByPair.values()) {
    pair
      .sort(
        (left, right) =>
          (left.matchdays?.round_number ?? 0) -
          (right.matchdays?.round_number ?? 0),
      )
      .forEach((fixture, index) =>
        legsByFixture.set(fixture.id, index === 0 ? 1 : 2),
      );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {leagueFixtures.map((fixture, index) => {
        const home = teamById.get(fixture.home_team_id);
        const away = teamById.get(fixture.away_team_id);
        return (
          <View key={fixture.id}>
            <Text style={styles.groupTitle}>Match {index + 1}</Text>
            <FixtureCard
              fixture={fixture}
              home={home?.name ?? "Home"}
              homeLogoPath={home?.logo_path}
              away={away?.name ?? "Away"}
              awayLogoPath={away?.logo_path}
              leg={legsByFixture.get(fixture.id)}
              canEdit={canEdit}
              onPress={() => onSelect(fixture)}
              onDelete={() => onDelete(fixture)}
            />
          </View>
        );
      })}
      {/* discard old rounds
        .sort(([a], [b]) => a - b)
        .map(([round, matches]) => (
          <View key={round}>
            <Text style={styles.groupTitle}>Match {round}</Text>
            {matches.map((fixture) => {
              const home = teamById.get(fixture.home_team_id);
              const away = teamById.get(fixture.away_team_id);
              return (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  home={home?.name ?? "Home"}
                  homeLogoPath={home?.logo_path}
                  away={away?.name ?? "Away"}
                  awayLogoPath={away?.logo_path}
                  leg={legsByFixture.get(fixture.id)}
                  canEdit={canEdit}
                  onPress={() => onSelect(fixture)}
                  onDelete={() => onDelete(fixture)}
                />
              );
            })}
          </View>
        ))}
      */}
      {finals.length ? (
        <View>
          <Text style={styles.groupTitle}>THE FINAL</Text>
          {finals.map((fixture) => {
            const home = teamById.get(fixture.home_team_id);
            const away = teamById.get(fixture.away_team_id);
            return (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                home={home?.name ?? "Home"}
                homeLogoPath={home?.logo_path}
                away={away?.name ?? "Away"}
                awayLogoPath={away?.logo_path}
                canEdit={canEdit}
                onPress={() => onSelect(fixture)}
                onDelete={() => onDelete(fixture)}
                final
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function FinalSection({
  fixture,
  teamById,
  isOwner,
  canEdit,
  championId,
  onOpenFixture,
  onDelete,
  onViewChampion,
}: {
  fixture: TournamentFixture;
  teamById: Map<string, { id: string; name: string; logo_path: string | null }>;
  isOwner: boolean;
  canEdit: boolean;
  championId: string | null;
  onOpenFixture: (fixture: TournamentFixture) => void;
  onDelete: (fixture: TournamentFixture) => void;
  onViewChampion: () => void;
}) {
  const home = teamById.get(fixture.home_team_id);
  const away = teamById.get(fixture.away_team_id);

  return (
    <View>
      <View style={styles.panelHeading}>
        <View>
          <Text style={styles.sectionTitle}>Championship final</Text>
          <Text style={styles.panelMeta}>
            A separate match, excluded from league standings
          </Text>
        </View>
        <Trophy color={colors.gold} size={20} />
      </View>
      <FixtureCard
        fixture={fixture}
        home={home?.name ?? "Home"}
        homeLogoPath={home?.logo_path}
        away={away?.name ?? "Away"}
        awayLogoPath={away?.logo_path}
        canEdit={canEdit}
        onPress={() => onOpenFixture(fixture)}
        onDelete={() => onDelete(fixture)}
        final
      />
      {championId ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewChampion}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>
            View championship celebration
          </Text>
          <ChevronRight color={colors.background} size={17} />
        </Pressable>
      ) : fixture.status === "played" ? (
        <View style={styles.drawNotice}>
          <CircleAlert color={colors.gold} size={18} />
          <Text style={styles.drawText}>
            The final is level. A tie-breaker is required before a champion can
            be declared.
          </Text>
        </View>
      ) : (
        <View style={styles.waitingFinal}>
          <Shield color={colors.muted} size={17} />
          <Text style={styles.waitingText}>
            {isOwner
              ?               "Open the fixture to record the result."
              : "The tournament owner has not recorded the final result yet."}
          </Text>
        </View>
      )}
    </View>
  );
}

function FixtureCard({
  fixture,
  home,
  homeLogoPath,
  away,
  awayLogoPath,
  leg,
  canEdit,
  onPress,
  onDelete,
  final = false,
}: {
  fixture: TournamentFixture;
  home: string;
  homeLogoPath?: string | null;
  away: string;
  awayLogoPath?: string | null;
  leg?: 1 | 2;
  canEdit: boolean;
  onPress: () => void;
  onDelete: () => void;
  final?: boolean;
}) {
  return (
    <View
      style={[
        styles.fixtureCard,
        fixture.status === "played" && styles.playedFixture,
        final && styles.finalFixture,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.fixtureMain,
          pressed && styles.fixtureMainPressed,
        ]}
      >
        <View
          style={[
            styles.fixtureMeta,
            canEdit && styles.fixtureMetaOwner,
          ]}
        >
          <Text style={styles.fixtureRound}>
            {final ? "CHAMPIONSHIP FINAL" : `LEG ${leg ?? "—"}`}
          </Text>
          {fixture.scheduled_at ? (
            <Text
              style={[styles.fixtureTime, canEdit && styles.fixtureTimeOwner]}
            >
              {new Date(fixture.scheduled_at).toLocaleString()}
            </Text>
          ) : null}
        </View>
        <View style={styles.matchRow}>
          <View style={styles.matchSide}>
            <Text style={styles.sideLabel}>HOME</Text>
            <TeamLabel name={home} logoPath={homeLogoPath} />
          </View>
          <Text
            style={[
              styles.score,
              fixture.status === "played" && styles.scorePlayed,
            ]}
          >
            {fixture.status === "played"
              ? `${fixture.home_score}  :  ${fixture.away_score}`
              : "VS"}
          </Text>
          <View style={styles.matchSide}>
            <Text style={[styles.sideLabel, styles.alignRight]}>AWAY</Text>
            <TeamLabel name={away} logoPath={awayLogoPath} alignRight />
          </View>
        </View>
        {fixture.status === "played" && fixture.goal_events?.length ? (
          <Text style={styles.scorerSummary} numberOfLines={1}>
            {fixture.goal_events
              .filter((event) => event.scorer_name)
              .map(
                (event) =>
                  `${event.scorer_name}${event.minute === null ? "" : ` ${event.minute}'`}`,
              )
              .join(" · ") || "Goal timeline recorded"}
          </Text>
        ) : null}
        <Text style={styles.editHint}>
          {canEdit
            ? fixture.status === "played"
              ? "Tap to edit result"
              : "Tap to record result"
            : "Tap to view match details"}
        </Text>
      </Pressable>
      {canEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete fixture: ${home} versus ${away}`}
          onPress={onDelete}
          style={styles.fixtureDelete}
        >
          <Trash2 color={colors.danger} size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TeamLabel({
  name,
  logoPath,
  alignRight = false,
}: {
  name: string;
  logoPath?: string | null;
  alignRight?: boolean;
}) {
  return (
    <View style={[styles.teamLabel, alignRight && styles.teamLabelRight]}>
      <TeamCrest name={name} logoPath={logoPath} size={30} />
      <Text
        numberOfLines={1}
        style={[styles.fixtureTeamName, alignRight && styles.alignRight]}
      >
        {name}
      </Text>
    </View>
  );
}

function TableSection({
  table,
  pending,
  hasFixtures,
  canCreateFinal,
  finalFixture,
  championId,
  isOwner,
  teamById,
  onCreateFinal,
  creatingFinal,
  onViewChampion,
}: {
  table: ReturnType<typeof calculateStandings>;
  pending: number;
  hasFixtures: boolean;
  canCreateFinal: boolean;
  finalFixture?: TournamentFixture;
  championId: string | null;
  isOwner: boolean;
  teamById: Map<string, { id: string; name: string; logo_path: string | null }>;
  onCreateFinal: () => void;
  creatingFinal: boolean;
  onViewChampion: () => void;
}) {
  return (
    <View>
      <View style={styles.tableIntro}>
        <View>
          <Text style={styles.sectionTitle}>League table</Text>
          <Text style={styles.panelMeta}>
            Points · goal difference · goals for · name
          </Text>
        </View>
        <Table2 color={colors.accent} size={20} />
      </View>
      {!hasFixtures ? (
        <View style={styles.empty}>
          <Table2 color={colors.accent} size={22} />
          <Text style={styles.emptyTitle}>The table is waiting</Text>
          <Text style={styles.emptyBody}>
            Standings appear once the league schedule is generated.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.cell, styles.posCell, styles.headText]}>
                POS
              </Text>
              <Text style={[styles.teamCell, styles.headText]}>TEAM</Text>
              {["MP", "W", "D", "L", "GF", "GA", "GD", "PTS", "LAST 5"].map(
                (label) => (
                  <Text
                    key={label}
                    style={[
                      styles.cell,
                      label === "LAST 5" && styles.formCell,
                      styles.headText,
                    ]}
                  >
                    {label}
                  </Text>
          
              )}
            </View>
            {table.map((row) => (
              <View
                key={row.id}
                style={[
                  styles.tableRow,
                  row.position === 1 && styles.leaderRow,
                ]}
              >
                <Text
                  style={[
                    styles.cell,
                    styles.posCell,
                    row.position === 1 && styles.leaderText,
                  ]}
                >
                  {String(row.position).padStart(2, "0")}
                </Text>
                <View style={styles.teamCell}>
                  <TeamCrest
                    name={row.name}
                    logoPath={teamById.get(row.id)?.logo_path}
                    size={24}
                  />
                  <Text numberOfLines={1} style={styles.teamName}>
                    {row.name}
                  </Text>
                </View>
                {[
                  row.matchesPlayed,
                  row.wins,
                  row.draws,
                  row.losses,
                  row.goalsFor,
                  row.goalsAgainst,
                  row.goalDifference,
                ].map((value, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.cell,
                      index === 6 &&
                        (value > 0
                          ? styles.positive
                          : value < 0
                            ? styles.negative
                            : null),
                    ]}
                  >
                    {value > 0 && index === 6 ? `+${value}` : value}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.pointsCell]}>
                  {row.points}
                </Text>
                <View style={[styles.cell, styles.formCell, styles.formList]}>
                  {row.recentForm.length ? (
                    row.recentForm.map((result, index) => (
                      <View
                        key={`${row.id}-${index}`}
                        style={[
                          styles.formDot,
                          result === "W"
                            ? styles.winDot
                            : result === "L"
                              ? styles.lossDot
                              : styles.drawDot,
                        ]}
                      >
                        <Text style={styles.formDotText}>{result}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.formEmpty}>—</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {finalFixture && championId ? (
        <View style={styles.championCard}>
          <View style={styles.championIcon}>
            <Crown color={colors.background} size={21} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.championKicker}>CHAMPIONS</Text>
            <Text style={styles.championName}>
              {teamById.get(championId)?.name ?? "Winner"}
            </Text>
            <Text style={styles.championScore}>
              Final {finalFixture.home_score} : {finalFixture.away_score}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open champion celebration"
            onPress={onViewChampion}
            style={styles.championOpen}
          >
            <ChevronRight color={colors.text} size={20} />
          </Pressable>
        </View>
      ) : null}
      {finalFixture?.status === "played" && championId === null ? (
        <View style={styles.drawNotice}>
          <CircleAlert color={colors.gold} size={18} />
          <Text style={styles.drawText}>
            The final is level. A tie-breaker is required before a champion can
            be declared.
          </Text>
        </View>
      ) : null}
      {!finalFixture &&
      hasFixtures &&
      pending === 0 &&
      canCreateFinal &&
      isOwner ? (
        <ActionBanner
          title="League stage complete"
          body={`The top two are ${table[0]?.name ?? "—"} and ${table[1]?.name ?? "—"}. Create their final to crown a champion.`}
          action="Create final"
          busy={creatingFinal}
          onPress={onCreateFinal}
        />
      ) : null}
      {!finalFixture && pending > 0 ? (
        <View style={styles.waitingFinal}>
          <Shield color={colors.muted} size={17} />
          <Text style={styles.waitingText}>
            {pending} league match{pending === 1 ? "" : "es"} left before the
            final can be created.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TournamentTeams({
  teams,
  isOwner,
  canRemove,
  completed,
  tournamentState,
  onOpenAddTeams,
  onRemove,
}: {
  teams: Array<{ id: string; name: string; logo_path: string | null }>;
  isOwner: boolean;
  canRemove: boolean;
  completed: boolean;
  tournamentState: "not_started" | "active" | "completed";
  onOpenAddTeams: () => void;
  onRemove: (team: { id: string; name: string }) => void;
}) {
  return (
    <View>
      <View style={styles.teamsHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Participating teams</Text>
          <Text style={styles.panelMeta}>
            {teams.length} clubs ·{" "}
            {tournamentState === "not_started"
              ? "roster can be edited freely"
              : tournamentState === "active"
                ? "fixtures active · roster locked"
                : "tournament completed · archived"}
          </Text>
        </View>
        {isOwner ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (tournamentState === "not_started") {
                onOpenAddTeams();
              } else if (tournamentState === "active") {
                Alert.alert(
                  "Tournament Active",
                  "Fixtures have already been generated. Teams cannot be added while the tournament is in progress.",
                );
              } else {
                Alert.alert(
                  "Tournament Completed",
                  "This tournament is completed. Team rosters cannot be modified.",
                );
              }
            }}
            style={[
              styles.addTeamsButton,
              tournamentState !== "not_started" && styles.addTeamsButtonLocked,
            ]}
          >
            {tournamentState === "not_started" ? (
              <>
                <Plus color={colors.background} size={15} />
                <Text style={styles.addTeamsButtonText}>Add teams</Text>
              </>
            ) : (
              <>
                <Lock color={colors.muted} size={13} />
                <Text style={styles.addTeamsButtonTextLocked}>Locked</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {tournamentState === "not_started" ? (
        <View style={styles.stateNoticeNotStarted}>
          <ShieldCheck color={colors.accent} size={16} />
          <Text style={styles.stateNoticeNotStartedText}>
            Tournament not started. You can add new teams or remove teams before generating fixtures.
          </Text>
        </View>
      ) : tournamentState === "active" ? (
        <View style={styles.stateNoticeActive}>
          <Lock color="#EAB308" size={16} />
          <Text style={styles.stateNoticeActiveText}>
            Tournament is active. Participating teams are locked to preserve the fixture schedule and standings.
          </Text>
        </View>
      ) : (
        <View style={styles.stateNoticeCompleted}>
          <Trophy color={colors.gold} size={16} />
          <Text style={styles.stateNoticeCompletedText}>
            Tournament is completed. Team rosters and final results are permanently archived.
          </Text>
        </View>
      )}

      <View style={styles.teamList}>
        {teams.map((team) => (
          <View key={team.id} style={styles.tournamentTeam}>
            <TeamCrest name={team.name} logoPath={team.logo_path} size={38} />
            <Text style={styles.tournamentTeamName}>{team.name}</Text>
            {isOwner ? (
              tournamentState === "not_started" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${team.name} from tournament`}
                  onPress={() => onRemove({ id: team.id, name: team.name })}
                  style={styles.teamRemove}
                >
                  <Trash2 color={colors.danger} size={16} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    Alert.alert(
                      "Teams Locked",
                      tournamentState === "active"
                        ? "Cannot remove teams while tournament fixtures are active."
                        : "Cannot remove teams from a completed tournament.",
                    );
                  }}
                  style={[styles.teamRemove, { opacity: 0.45 }]}
                >
                  <Lock color={colors.dim} size={14} />
                </Pressable>
              )
            ) : (
              <Shield color={colors.dim} size={15} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function AddTeamsModal({
  visible,
  onClose,
  onAdd,
  isPending,
  clubTeams,
  existingTeamIds,
  tournamentName,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (selectedIds: string[]) => void;
  isPending: boolean;
  clubTeams: TeamRecord[];
  existingTeamIds: Set<string>;
  tournamentName: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const availableTeams = useMemo(
    () => clubTeams.filter((t) => !existingTeamIds.has(t.id)),
    [clubTeams, existingTeamIds],
  );

  const filteredTeams = useMemo(
    () =>
      availableTeams.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [availableTeams, searchQuery],
  );

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setSearchQuery("");
    }
  }, [visible]);

  const toggleTeam = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredTeams.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTeams.map((t) => t.id));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!isPending) onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Add Teams</Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                {tournamentName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              disabled={isPending}
              onPress={onClose}
              style={styles.modalClose}
            >
              <X color={colors.text} size={18} />
            </Pressable>
          </View>

          {availableTeams.length === 0 ? (
            <View style={styles.modalEmpty}>
              <ShieldCheck color={colors.accent} size={36} />
              <Text style={styles.modalEmptyTitle}>All Club Teams Added</Text>
              <Text style={styles.modalEmptyBody}>
                Every team in your club roster is already participating in this
                tournament.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={[styles.actionButton, { marginTop: spacing.md }]}
              >
                <Text style={styles.actionButtonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {availableTeams.length > 5 ? (
                <View style={styles.modalSearchRow}>
                  <Search color={colors.dim} size={16} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search club teams…"
                    placeholderTextColor={colors.dim}
                    style={styles.modalSearchInput}
                  />
                  {searchQuery ? (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <X color={colors.dim} size={15} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {filteredTeams.length > 1 ? (
                <View style={styles.modalSelectionSummary}>
                  <Text style={styles.modalSelectionCount}>
                    {selectedIds.length} of {filteredTeams.length} selected
                  </Text>
                  <Pressable onPress={selectAll}>
                    <Text style={styles.modalSelectAll}>
                      {selectedIds.length === filteredTeams.length
                        ? "Deselect all"
                        : "Select all"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <ScrollView
                style={{ maxHeight: 320, marginTop: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {filteredTeams.map((team) => {
                  const isSelected = selectedIds.includes(team.id);
                  return (
                    <Pressable
                      key={team.id}
                      onPress={() => toggleTeam(team.id)}
                      style={[
                        styles.teamPickerRow,
                        isSelected && styles.teamPickerRowSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected ? (
                          <Check color={colors.background} size={13} />
                        ) : null}
                      </View>
                      <TeamCrest
                        name={team.name}
                        logoPath={team.logo_path}
                        size={34}
                      />
                      <Text style={styles.teamPickerName} numberOfLines={1}>
                        {team.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.modalFooterActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isPending}
                  onPress={onClose}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={selectedIds.length === 0 || isPending}
                  onPress={() => onAdd(selectedIds)}
                  style={[
                    styles.modalSubmitBtn,
                    (selectedIds.length === 0 || isPending) && styles.disabled,
                  ]}
                >
                  {isPending ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <>
                      <Plus color={colors.background} size={16} />
                      <Text style={styles.modalSubmitBtnText}>
                        Add {selectedIds.length || ""}{" "}
                        {selectedIds.length === 1 ? "team" : "teams"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* discard old TournamentTeams
function TournamentTeams({
  teams,
  isOwner,
  canRemove,
  completed,
  onRemove,
}: {
  teams: Array<{ id: string; name: string; logo_path: string | null }>;
  isOwner: boolean;
  canRemove: boolean;
  completed: boolean;
  onRemove: (team: { id: string; name: string }) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Participating teams</Text>
      <Text style={styles.panelMeta}>
        {teams.length} clubs ·{" "}
        {isOwner
          ? completed
            ? "completed tournaments are read-only"
            : "global team details stay with their owners"
          : "read-only member access"}
      </Text>
      <View style={styles.teamList}>
        {teams.map((team) => (
          <View key={team.id} style={styles.tournamentTeam}>
            <TeamCrest name={team.name} logoPath={team.logo_path} size={38} />
            <Text style={styles.tournamentTeamName}>{team.name}</Text>
            {canRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${team.name} from tournament`}
                onPress={() => onRemove({ id: team.id, name: team.name })}
                style={styles.teamRemove}
              >
                <Trash2 color={colors.danger} size={16} />
              </Pressable>
            ) : (
              <Shield color={colors.dim} size={15} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

*/
function ActivityFeed({
  activity,
  loading,
  error,
  onRetry,
}: {
  activity: Array<{ id: string; event_type: string; created_at: string }>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <ActivityIndicator
        color={colors.accent}
        style={{ marginTop: spacing.xl }}
      />
    );
  if (error)
    return (
      <Pressable onPress={onRetry}>
        <Text style={styles.error}>Couldn’t load activity. Tap to retry.</Text>
      </Pressable>
    );
  if (!activity.length)
    return (
      <View style={styles.empty}>
        <Activity color={colors.accent} size={22} />
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyBody}>
          Tournament activity will appear here.
        </Text>
      </View>
    );
  return (
    <View>
      {activity.map((event) => (
        <View key={event.id} style={styles.activityRow}>
          <View style={styles.activityMarker} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activityTitle}>
              {event.event_type.replaceAll("_", " ")}
            </Text>
            <Text style={styles.panelMeta}>
              {new Date(event.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ResultModal({
  fixture,
  teamById,
  canEdit,
  busy,
  error,
  onClose,
  onSave,
}: {
  fixture: TournamentFixture;
  teamById: Map<string, { id: string; name: string; logo_path: string | null }>;
  canEdit: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: {
    fixtureId: string;
    expectedVersion: number;
    status: "pending" | "played";
    homeScore: number | null;
    awayScore: number | null;
    goalEvents: GoalEventInput[];
    notes: string;
    notesImagePath: string | null;
    imageAsset: ImagePicker.ImagePickerAsset | null;
    previousNotesImagePath: string | null;
  }) => void;
}) {
  const [homeScore, setHomeScore] = useState(
    fixture.home_score === null ? "" : String(fixture.home_score),
  );
  const [awayScore, setAwayScore] = useState(
    fixture.away_score === null ? "" : String(fixture.away_score),
  );
  const [notes, setNotes] = useState(fixture.notes ?? "");
  const [notesImagePath, setNotesImagePath] = useState(
    fixture.notes_image_path,
  );
  const [imageAsset, setImageAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [validationError, setValidationError] = useState("");
  const homeName = teamById.get(fixture.home_team_id)?.name ?? "Home";
  const awayName = teamById.get(fixture.away_team_id)?.name ?? "Away";
  const noteImageQuery = useQuery({
    queryKey: ["match-note-image", notesImagePath],
    queryFn: () => getSignedMatchNoteUrl(notesImagePath!),
    enabled: Boolean(notesImagePath) && !imageAsset,
    staleTime: 45 * 60 * 1000,
    retry: 1,
  });
  const chooseNoteImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access required",
          "Allow photo library access to add a match photo.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) setImageAsset(result.assets[0] ?? null);
    } catch (error) {
      Alert.alert(
        "Could not open photos",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const visibleImageUri =
    imageAsset?.uri ?? (notesImagePath ? noteImageQuery.data : undefined);
  const hasNoteImage = Boolean(imageAsset || notesImagePath);
  const save = () => {
    setValidationError("");
    if (!/^\d+$/.test(homeScore) || !/^\d+$/.test(awayScore)) {
      setValidationError(
        "Enter a non-negative whole-number score for both teams.",
      );
      return;
    }
    const homeGoals = Number(homeScore);
    const awayGoals = Number(awayScore);
    const existingEvents = fixture.goal_events ?? [];
    const existingHomeEvents = existingEvents.filter(
      (event) => event.team_id === fixture.home_team_id,
    ).length;
    const existingAwayEvents = existingEvents.filter(
      (event) => event.team_id === fixture.away_team_id,
    ).length;
    const goalEvents =
      existingHomeEvents === homeGoals && existingAwayEvents === awayGoals
        ? existingEvents.map(
            ({ team_id, scorer_name, minute, goal_type }) => ({
              team_id,
              scorer_name,
              minute,
              goal_type,
            }),
          )
        : [];
    onSave({
      fixtureId: fixture.id,
      expectedVersion: fixture.version,
      status: "played",
      homeScore: homeGoals,
      awayScore: awayGoals,
      goalEvents,
      notes,
      notesImagePath,
      imageAsset,
      previousNotesImagePath: fixture.notes_image_path,
    });
  };
  const revert = () =>
    onSave({
      fixtureId: fixture.id,
      expectedVersion: fixture.version,
      status: "pending",
      homeScore: null,
      awayScore: null,
      goalEvents: [],
      notes,
      notesImagePath,
      imageAsset,
      previousNotesImagePath: fixture.notes_image_path,
    });

  return (
    <View style={styles.resultEditor}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.fixtureRound}>
            {fixture.stage === "final"
              ? "THE FINAL"
              : `Match ${fixture.matchdays?.round_number ?? "—"}`}
          </Text>
          <Text style={styles.modalTitle}>
            {canEdit ? "Match result" : "Match details"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <X color={colors.text} size={19} />
        </Pressable>
      </View>
      <View style={styles.modalBody}>
        <Text style={styles.panelMeta}>
          {fixture.status === "played" ? "PLAYED" : "PENDING"} ·{" "}
          {fixture.scheduled_at
            ? new Date(fixture.scheduled_at).toLocaleString()
            : "Time TBD"}
        </Text>
        <View style={styles.scoreForm}>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreTeam} numberOfLines={1}>
              {homeName}
            </Text>
            {canEdit ? (
              <TextInput
                keyboardType="number-pad"
                value={homeScore}
                onChangeText={setHomeScore}
                placeholder="0"
                placeholderTextColor={colors.dim}
                style={styles.scoreInput}
              />
            ) : (
              <Text style={styles.readOnlyScore}>
                {fixture.status === "played"
                  ? (fixture.home_score ?? "—")
                  : "VS"}
              </Text>
            )}
          </View>
          <Text style={styles.scoreSeparator}>:</Text>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreTeam} numberOfLines={1}>
              {awayName}
            </Text>
            {canEdit ? (
              <TextInput
                keyboardType="number-pad"
                value={awayScore}
                onChangeText={setAwayScore}
                placeholder="0"
                placeholderTextColor={colors.dim}
                style={styles.scoreInput}
              />
            ) : (
              <Text style={styles.readOnlyScore}>
                {fixture.status === "played"
                  ? (fixture.away_score ?? "—")
                  : "VS"}
              </Text>
            )}
          </View>
        </View>
        {canEdit ? (
          <>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>
              MATCH NOTES <Text style={styles.optional}>OPTIONAL</Text>
            </Text>
            <View style={styles.noteActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void chooseNoteImage()}
                style={styles.noteImageButton}
              >
                <ImagePlus color={colors.accent} size={16} />
                <Text style={styles.noteImageButtonText}>
                  {hasNoteImage ? "Change photo" : "Add photo"}
                </Text>
              </Pressable>
              {hasNoteImage ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setImageAsset(null);
                    setNotesImagePath(null);
                  }}
                  style={styles.removeNoteImage}
                >
                  <Text style={styles.removeNoteImageText}>Remove photo</Text>
                </Pressable>
              ) : null}
            </View>
            {visibleImageUri ? (
              <Image
                source={{ uri: visibleImageUri }}
                resizeMode="cover"
                style={styles.noteImagePreview}
              />
            ) : null}
            {noteImageQuery.isError && notesImagePath && !imageAsset ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void noteImageQuery.refetch()}
              >
                <Text style={styles.error}>
                  Couldn’t load attached photo. Tap to retry.
                </Text>
              </Pressable>
            ) : null}
            <TextInput
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              multiline
              placeholder="Add a note for the activity feed"
              placeholderTextColor={colors.dim}
              style={[styles.input, styles.notesInput]}
            />
          </>
        ) : notes || fixture.notes_image_path ? (
          <View style={styles.readOnlyNotes}>
            <Text style={styles.label}>MATCH NOTES</Text>
            {noteImageQuery.data ? (
              <Image
                source={{ uri: noteImageQuery.data }}
                resizeMode="cover"
                style={styles.noteImagePreview}
              />
            ) : null}
            {noteImageQuery.isError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void noteImageQuery.refetch()}
              >
                <Text style={styles.error}>
                  Couldn’t load attached photo. Tap to retry.
                </Text>
              </Pressable>
            ) : null}
            {notes ? (
              <Text style={styles.readOnlyNoteText}>{notes}</Text>
            ) : null}
          </View>
        ) : null}
        {validationError || error ? (
          <Text style={styles.error}>{validationError || error}</Text>
        ) : null}
      </View>
      {canEdit ? (
        <View style={styles.modalFooter}>
          {fixture.status === "played" ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={revert}
              style={styles.revertButton}
            >
              <RefreshCw color={colors.muted} size={15} />
              <Text style={styles.revertText}>Revert to pending</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={save}
            style={[styles.actionButton, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Check color={colors.background} size={17} />
                <Text style={styles.actionButtonText}>Save result</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  goalOverlay: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 50,
    elevation: 8,
  },
  goalToast: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
  },
  goalAccent: {
    width: 4,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  goalCopy: { flex: 1, minWidth: 0 },
  goalKicker: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  goalTeam: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  goalMatch: { color: colors.muted, fontSize: 10, marginTop: 3 },
  goalDismiss: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
    borderRadius: radii.sm,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  muted: { color: colors.muted, fontSize: 13 },
  retry: { color: colors.accent, fontWeight: "800", padding: 12 },
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: 38,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  kicker: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 3,
  },
  tournamentTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "#21372B",
  },
  statusBadgeComplete: { backgroundColor: "#3A3424" },
  statusText: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { color: colors.text, fontFamily: "SpaceMono", fontSize: 16 },
  summaryTotal: { color: colors.dim, fontSize: 12 },
  summaryLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginTop: 3,
  },
  summaryLine: { width: 1, height: 26, backgroundColor: colors.border },
  sectionNavigation: {
    height: 46,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabs: {
    paddingHorizontal: spacing.md,
    gap: 4,
    minHeight: 45,
    alignItems: "stretch",
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: colors.accent },
  bodyScroll: { flex: 1, minHeight: 0 },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  panelHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  panelMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  progressPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  progressNumber: { color: colors.text, fontFamily: "SpaceMono", fontSize: 12 },
  progressTrack: {
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.elevated,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  progressCaption: { color: colors.muted, fontSize: 10, marginTop: spacing.sm },
  leaderPanel: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "#52492B",
    borderRadius: radii.md,
    backgroundColor: "#28271F",
    padding: spacing.md,
  },
  leaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B3522",
  },
  leaderName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
  leaderPoints: { color: colors.gold, fontFamily: "SpaceMono", fontSize: 16 },
  pts: { color: colors.muted, fontSize: 9 },
  sectionBlock: { marginTop: spacing.xl, gap: 8 },
  miniMatch: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  miniTeam: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "700" },
  awayTeam: { textAlign: "right" },
  miniScore: {
    width: 64,
    textAlign: "center",
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 12,
  },
  championStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: spacing.lg,
    backgroundColor: "#2B281D",
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  championStripText: {
    flex: 1,
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
  },
  actionBanner: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: "#1B2E23",
    borderWidth: 1,
    borderColor: "#31563C",
    borderRadius: radii.md,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#294333",
    marginBottom: spacing.md,
  },
  actionTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  actionBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  actionButton: {
    minHeight: 43,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  actionButtonText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: "900",
  },
  disabled: { opacity: 0.55 },
  groupTitle: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fixtureCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
  },
  fixtureMain: { flex: 1 },
  fixtureMainPressed: { opacity: 0.82 },
  playedFixture: { borderColor: colors.accent },
  finalFixture: { borderColor: colors.gold },
  fixtureMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 13,
    gap: 8,
  },
  fixtureMetaOwner: { paddingRight: 38, marginBottom: 22 },
  fixtureTimeOwner: { marginRight: 38 },
  fixtureDelete: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
  },
  fixtureRound: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  fixtureTime: { color: colors.dim, fontSize: 9 },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  matchSide: { flex: 1, minWidth: 0, gap: 6 },
  sideLabel: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  scorerSummary: { color: colors.muted, fontSize: 9, marginTop: 10 },
  teamLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  teamLabelRight: { flexDirection: "row-reverse" },
  teamCrest: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  teamCrestText: { color: colors.accent, fontSize: 12, fontWeight: "900" },
  fixtureTeamName: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  alignRight: { textAlign: "right" },
  score: {
    minWidth: 65,
    textAlign: "center",
    color: colors.muted,
    fontFamily: "SpaceMono",
    fontSize: 11,
  },
  scorePlayed: { color: colors.text, fontSize: 13 },
  editHint: {
    color: colors.dim,
    textAlign: "right",
    fontSize: 9,
    marginTop: 10,
  },
  tableIntro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  table: {
    minWidth: 780,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  tableHead: { backgroundColor: colors.elevated },
  tableRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  leaderRow: { backgroundColor: "#1B2E23" },
  headText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  cell: {
    width: 42,
    textAlign: "center",
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 10,
  },
  posCell: { width: 40 },
  teamCell: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 7,
  },
  teamName: { flex: 1, color: colors.text, fontSize: 10, fontWeight: "800" },
  leaderText: { color: colors.accent },
  pointsCell: { color: colors.accent, fontWeight: "900" },
  positive: { color: colors.success },
  negative: { color: colors.danger },
  formCell: { width: 92 },
  formList: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  formDot: {
    width: 17,
    height: 17,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  winDot: { backgroundColor: colors.success },
  lossDot: { backgroundColor: colors.danger },
  drawDot: { backgroundColor: colors.draw },
  formDotText: { color: colors.background, fontSize: 8, fontWeight: "900" },
  formEmpty: { color: colors.dim, fontSize: 12 },
  championCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2B281D",
    borderWidth: 1,
    borderColor: "#5B4E2D",
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  championIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  championKicker: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  championName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  championScore: { color: colors.muted, fontSize: 10, marginTop: 3 },
  championOpen: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  drawNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#302B1F",
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.lg,
  },
  drawText: { flex: 1, color: colors.gold, fontSize: 11, lineHeight: 17 },
  waitingFinal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  waitingText: { color: colors.muted, flex: 1, fontSize: 11 },
  teamList: { gap: 8, marginTop: spacing.lg },
  tournamentTeam: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  tournamentTeamName: {
    flex: 1,
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
  },
  teamRemove: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
  },
  activityRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  activityTitle: {
    color: colors.text,
    textTransform: "capitalize",
    fontWeight: "700",
    fontSize: 12,
  },
  empty: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 15 },
  emptyBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 300,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.md },
  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  confirmPanel: {
    width: "100%",
    maxWidth: 440,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  confirmTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  confirmBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  confirmCancel: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  confirmCancelText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  confirmButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  confirmButtonText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "900",
  },
  resultEditor: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  close: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  modalBody: {
    padding: spacing.lg,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  scoreForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  scoreSide: { flex: 1, alignItems: "center", minWidth: 0 },
  scoreTeam: {
    width: "100%",
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  scoreInput: {
    width: 70,
    height: 62,
    textAlign: "center",
    backgroundColor: colors.elevated,
    borderRadius: radii.sm,
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 25,
  },
  readOnlyScore: {
    width: 70,
    height: 62,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: colors.elevated,
    borderRadius: radii.sm,
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 20,
    overflow: "hidden",
    paddingTop: 14,
  },
  scoreSeparator: { color: colors.dim, fontSize: 20 },
  label: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  optional: { color: colors.dim, fontSize: 8 },
  input: {
    minHeight: 45,
    color: colors.text,
    fontSize: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  notesInput: {
    minHeight: 72,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  readOnlyNotes: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  noteActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  noteImageButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  noteImageButtonText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  removeNoteImage: { paddingVertical: 10 },
  removeNoteImageText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "700",
  },
  noteImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.elevated,
  },
  readOnlyNoteText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  revertButton: {
    minHeight: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  revertText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  statusBadgeNotStarted: {
    backgroundColor: "rgba(234, 179, 8, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  statusBadgeActive: {
    backgroundColor: "#21372B",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  statusTextNotStarted: { color: "#EAB308" },
  statusTextActive: { color: colors.accent },
  statusTextComplete: { color: "#A5B4FC" },
  teamsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  addTeamsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  addTeamsButtonText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: "900",
  },
  addTeamsButtonLocked: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTeamsButtonTextLocked: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  stateNoticeNotStarted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  stateNoticeNotStartedText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
  },
  stateNoticeActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  stateNoticeActiveText: {
    flex: 1,
    color: "#EAB308",
    fontSize: 11,
    lineHeight: 16,
  },
  stateNoticeCompleted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  stateNoticeCompletedText: {
    flex: 1,
    color: "#A5B4FC",
    fontSize: 11,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  modalSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  modalEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: 10,
  },
  modalEmptyTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  modalEmptyBody: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  modalSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    marginBottom: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    paddingVertical: 0,
  },
  modalSelectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginBottom: 6,
  },
  modalSelectionCount: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  modalSelectAll: { color: colors.accent, fontSize: 11, fontWeight: "800" },
  teamPickerRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.elevated,
    borderRadius: radii.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamPickerRowSelected: {
    borderColor: colors.accent,
    backgroundColor: "#15241C",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.dim,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  teamPickerName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  modalFooterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  modalSubmitBtn: {
    flex: 2,
    height: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  modalSubmitBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "900",
  },
});
