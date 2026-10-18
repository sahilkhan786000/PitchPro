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
  Medal,
  RefreshCw,
  Share2,
  Shield,
  Table2,
  Trash2,
  Trophy,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/src/components/AuthGate";
import { TeamCrest } from "@/src/components/TeamCrest";
import {
  assessFinalEligibility,
  resolveFinalWinner,
} from "@/src/features/finals/rules";
import { calculateStandings } from "@/src/features/standings/calculateStandings";
import { ShareSheet } from "@/src/features/tournaments/ShareSheet";
import {
  createFinal,
  deleteTournamentFixture,
  generateFixtures,
  getTournament,
  listActivity,
  removeTournamentTeam,
  saveFixtureResult,
  scheduleFixture,
  subscribeToTournament,
  type GoalEventInput,
  type TournamentFixture,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { supabaseConfigured } from "@/src/lib/supabase";
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
const sections: Array<{ id: Section; title: string }> = [
  { id: "overview", title: "Overview" },
  { id: "fixtures", title: "Fixtures" },
  { id: "table", title: "Table" },
  { id: "teams", title: "Teams" },
  { id: "activity", title: "Activity" },
];

export default function TournamentScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <TournamentContent />
    </AuthGate>
  );
}

function TournamentContent() {
  const params = useLocalSearchParams<{ id: string; fixtureId?: string }>();
  const tournamentId = typeof params.id === "string" ? params.id : "";
  const fixtureId =
    typeof params.fixtureId === "string" ? params.fixtureId : "";
  const { session } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [selectedFixture, setSelectedFixture] =
    useState<TournamentFixture | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const openedFixtureId = useRef<string | null>(null);
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
    if (!fixtureId || !data || openedFixtureId.current === fixtureId) return;
    const fixture = data.fixtures.find((item) => item.id === fixtureId);
    if (!fixture) return;
    openedFixtureId.current = fixtureId;
    setSection("fixtures");
    setSelectedFixture(fixture);
  }, [data, fixtureId]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateFixtures(
        tournamentId,
        data?.teams.map(({ id, name }) => ({ id, name })) ?? [],
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
    },
  });
  const finalMutation = useMutation({
    mutationFn: () => createFinal(tournamentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
      setSection("fixtures");
    },
  });
  const resultMutation = useMutation({
    mutationFn: saveFixtureResult,
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
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
  const scheduleMutation = useMutation({
    mutationFn: scheduleFixture,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
      setSelectedFixture(null);
    },
  });
  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => removeTournamentTeam(tournamentId, teamId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({
        queryKey: ["unread-notification-count"],
      });
      setConfirmation(null);
      setSelectedFixture(null);
    },
  });
  const deleteFixtureMutation = useMutation({
    mutationFn: (fixtureId: string) => deleteTournamentFixture(fixtureId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["activity", tournamentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({
        queryKey: ["unread-notification-count"],
      });
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

  if (query.isLoading)
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading tournament…</Text>
      </SafeAreaView>
    );
  if (query.isError || !data)
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <CircleAlert color={colors.danger} size={22} />
        <Text style={styles.muted}>Couldn’t load this tournament.</Text>
        <Pressable onPress={() => query.refetch()}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
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
            data.tournament.status === "completed" &&
              styles.statusBadgeComplete,
          ]}
        >
          <Text style={styles.statusText}>
            {data.tournament.status === "active" ? "ACTIVE" : "DONE"}
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
            onPress={() => {
              if (selectedFixture) {
                setSelectedFixture(null);
                resultMutation.reset();
              }
              setSection(item.id);
            }}
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
      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body}>
        {selectedFixture ? (
          <ResultModal
            fixture={selectedFixture}
            teamById={teamById}
            canEdit={Boolean(isOwner)}
            busy={resultMutation.isPending}
            error={resultMutation.error?.message}
            scheduleBusy={scheduleMutation.isPending}
            scheduleError={scheduleMutation.error?.message}
            onClose={() => {
              setSelectedFixture(null);
              resultMutation.reset();
            }}
            onSave={(input) => resultMutation.mutate(input)}
            onSchedule={(input) => scheduleMutation.mutate(input)}
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
                canEdit={Boolean(isOwner)}
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
                onRemove={(team) => {
                  removeTeamMutation.reset();
                  setConfirmation({ kind: "removeTeam", team })
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
            {scheduleMutation.error ? (
              <Text style={styles.error}>{scheduleMutation.error.message}</Text>
            ) : null}
          </>
        )}
      </ScrollView>
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
                ? `${data.teams.length * (data.teams.length - 1)} matches across ${data.teams.length % 2 === 0 ? 2 * (data.teams.length - 1) : 2 * data.teams.length} matchdays. Every team plays each opponent home and away.`
                : confirmation === "final"
                  ? `${table[0]?.name ?? "First place"} and ${table[1]?.name ?? "Second place"} will play for the championship.`
                  : confirmation?.kind === "removeTeam"
                    ? `${confirmation.team.name} and its fixtures and recorded results will be removed from this tournament. The team itself remains in your club.`
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
        <ShareSheet
          tournamentId={tournamentId}
          tournamentName={data.tournament.name}
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
        />
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
          title="The league is ready to schedule"
          body="Generate the complete home-and-away fixture list."
          action="Generate fixtures"
          busy={generating}
          onPress={onGenerate}
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
  const leagueFixtures = fixtures.filter((item) => item.stage === "league");
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
      {[...rounds.entries()]
        .sort(([a], [b]) => a - b)
        .map(([round, matches]) => (
          <View key={round}>
            <Text style={styles.groupTitle}>M{round}</Text>
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
  championId,
  onOpenFixture,
  onDelete,
  onViewChampion,
}: {
  fixture: TournamentFixture;
  teamById: Map<string, { id: string; name: string; logo_path: string | null }>;
  isOwner: boolean;
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
        canEdit={isOwner}
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
              ? "Open the fixture to set a kickoff time or record the result."
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
    <View style={[styles.fixtureCard, final && styles.finalFixture]}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.fixtureMain}>
        <View style={styles.fixtureMeta}>
          <Text style={styles.fixtureRound}>
            {final ? "CHAMPIONSHIP FINAL" : `LEG ${leg ?? "—"}`}
          </Text>
          <Text style={[styles.fixtureTime, canEdit && styles.fixtureTimeOwner]}>
            {fixture.scheduled_at
              ? new Date(fixture.scheduled_at).toLocaleString()
              : "Time TBD"}
          </Text>
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
              <Text style={[styles.clubCell, styles.headText]}>CLUB</Text>
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
                ),
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
                <View style={styles.clubCell}>
                  <View style={styles.smallCrest}>
                    <Text style={styles.smallCrestText}>
                      {row.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.clubName}>
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
  onRemove,
}: {
  teams: Array<{ id: string; name: string; logo_path: string | null }>;
  isOwner: boolean;
  onRemove: (team: { id: string; name: string }) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Participating teams</Text>
      <Text style={styles.panelMeta}>
        {teams.length} clubs ·{" "}
        {isOwner
          ? "global team details stay with their owners"
          : "read-only member access"}
      </Text>
      <View style={styles.teamList}>
        {teams.map((team) => (
          <View key={team.id} style={styles.tournamentTeam}>
            <TeamCrest name={team.name} logoPath={team.logo_path} size={38} />
            <Text style={styles.tournamentTeamName}>{team.name}</Text>
            {isOwner ? (
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
          Tournament updates will appear here.
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
  scheduleBusy,
  scheduleError,
  onClose,
  onSave,
  onSchedule,
}: {
  fixture: TournamentFixture;
  teamById: Map<string, { id: string; name: string; logo_path: string | null }>;
  canEdit: boolean;
  busy: boolean;
  error?: string;
  scheduleBusy: boolean;
  scheduleError?: string;
  onClose: () => void;
  onSave: (input: {
    fixtureId: string;
    expectedVersion: number;
    status: "pending" | "played";
    homeScore: number | null;
    awayScore: number | null;
    goalEvents: GoalEventInput[];
    notes: string;
  }) => void;
  onSchedule: (input: {
    fixtureId: string;
    expectedVersion: number;
    scheduledAt: string | null;
  }) => void;
}) {
  const [homeScore, setHomeScore] = useState(
    fixture.home_score === null ? "" : String(fixture.home_score),
  );
  const [awayScore, setAwayScore] = useState(
    fixture.away_score === null ? "" : String(fixture.away_score),
  );
  const scorerText = (teamId: string) =>
    (fixture.goal_events ?? [])
      .filter((event) => event.team_id === teamId)
      .map((event) =>
        `${event.scorer_name ?? ""}${event.minute === null ? "" : ` (${event.minute})`}`.trim(),
      )
      .join(", ");
  const [homeScorers, setHomeScorers] = useState(() =>
    scorerText(fixture.home_team_id),
  );
  const [awayScorers, setAwayScorers] = useState(() =>
    scorerText(fixture.away_team_id),
  );
  const [notes, setNotes] = useState(fixture.notes ?? "");
  const [kickoff, setKickoff] = useState(() =>
    fixture.scheduled_at ? formatLocalKickoff(fixture.scheduled_at) : "",
  );
  const [validationError, setValidationError] = useState("");
  const homeName = teamById.get(fixture.home_team_id)?.name ?? "Home";
  const awayName = teamById.get(fixture.away_team_id)?.name ?? "Away";
  const schedule = () => {
    const value = kickoff.trim();
    if (!value) {
      onSchedule({
        fixtureId: fixture.id,
        expectedVersion: fixture.version,
        scheduledAt: null,
      });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
      setValidationError("Use local time in YYYY-MM-DD HH:mm format.");
      return;
    }
    const parsed = new Date(`${value.replace(" ", "T")}:00`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      formatLocalKickoff(parsed.toISOString()) !== value
    ) {
      setValidationError("Enter a valid local date and time.");
      return;
    }
    setValidationError("");
    onSchedule({
      fixtureId: fixture.id,
      expectedVersion: fixture.version,
      scheduledAt: parsed.toISOString(),
    });
  };
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
    const makeEvents = (
      value: string,
      teamId: string,
      score: number,
    ): GoalEventInput[] | null => {
      const entries = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (!entries.length) return [];
      if (entries.length !== score) return null;
      return entries.map((entry) => {
        const match = entry.match(/^(.*?)(?:\s*\((\d{1,3})\))?$/);
        return {
          team_id: teamId,
          scorer_name: match?.[1]?.trim() || null,
          minute: match?.[2] ? Number(match[2]) : null,
          goal_type: "regular",
        };
      });
    };
    const homeEvents = makeEvents(homeScorers, fixture.home_team_id, homeGoals);
    const awayEvents = makeEvents(awayScorers, fixture.away_team_id, awayGoals);
    if (!homeEvents || !awayEvents) {
      setValidationError(
        "For scorer details, list every goal as Name or Name (minute), separated by commas.",
      );
      return;
    }
    onSave({
      fixtureId: fixture.id,
      expectedVersion: fixture.version,
      status: "played",
      homeScore: homeGoals,
      awayScore: awayGoals,
      goalEvents: [...homeEvents, ...awayEvents],
      notes,
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
    });

  return (
    <View style={styles.resultEditor}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.fixtureRound}>
            {fixture.stage === "final"
              ? "THE FINAL"
              : `MATCHDAY ${fixture.matchdays?.round_number ?? "—"}`}
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
            <Text style={styles.label}>
              SCORERS <Text style={styles.optional}>OPTIONAL</Text>
            </Text>
            <TextInput
              value={homeScorers}
              onChangeText={setHomeScorers}
              placeholder={`${homeName}: e.g. A. Player (34), B. Player (71)`}
              placeholderTextColor={colors.dim}
              style={styles.input}
            />
            <TextInput
              value={awayScorers}
              onChangeText={setAwayScorers}
              placeholder={`${awayName}: scorer names and minutes`}
              placeholderTextColor={colors.dim}
              style={[styles.input, { marginTop: spacing.sm }]}
            />
            <Text style={styles.helper}>
              If entered, scorer count must match that team’s score. Minutes are
              optional.
            </Text>
          </>
        ) : null}
        {fixture.goal_events?.length ? (
          <View style={styles.timeline}>
            <Text style={styles.label}>GOAL TIMELINE</Text>
            {[...fixture.goal_events]
              .sort(
                (left, right) => (left.minute ?? 999) - (right.minute ?? 999),
              )
              .map((event) => (
                <View key={event.id} style={styles.timelineRow}>
                  <Text style={styles.goalMinute}>
                    {event.minute === null ? "—" : `${event.minute}'`}
                  </Text>
                  <Text style={styles.goalScorer}>
                    {event.scorer_name || "Scorer not recorded"}
                  </Text>
                  <Text style={styles.goalTeam}>
                    {teamById.get(event.team_id)?.name ?? "Team"}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}
        {canEdit ? (
          <>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>
              MATCH NOTES <Text style={styles.optional}>OPTIONAL</Text>
            </Text>
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
        ) : notes ? (
          <View style={styles.readOnlyNotes}>
            <Text style={styles.label}>MATCH NOTES</Text>
            <Text style={styles.readOnlyNoteText}>{notes}</Text>
          </View>
        ) : null}
        {validationError || error || scheduleError ? (
          <Text style={styles.error}>
            {validationError || error || scheduleError}
          </Text>
        ) : null}
      </View>
      {canEdit ? (
        <View style={styles.modalFooter}>
          {fixture.status === "pending" ? (
            <>
              <Text style={styles.label}>KICKOFF · DEVICE LOCAL TIME</Text>
              <TextInput
                value={kickoff}
                onChangeText={setKickoff}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.dim}
                style={styles.input}
                autoCapitalize="none"
              />
              <Pressable
                accessibilityRole="button"
                disabled={scheduleBusy}
                onPress={schedule}
                style={styles.scheduleButton}
              >
                {scheduleBusy ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <>
                    <CalendarClock color={colors.accent} size={15} />
                    <Text style={styles.scheduleText}>
                      {kickoff ? "Save kickoff time" : "Clear kickoff time"}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : null}
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

function formatLocalKickoff(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16).replace("T", " ");
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
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
  finalFixture: { borderColor: colors.accent },
  fixtureMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 13,
    gap: 8,
  },
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
  clubCell: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 7,
  },
  smallCrest: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCrestText: { color: colors.accent, fontSize: 9, fontWeight: "900" },
  clubName: { flex: 1, color: colors.text, fontSize: 10, fontWeight: "800" },
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
  helper: { color: colors.dim, fontSize: 9, lineHeight: 14, marginTop: 6 },
  timeline: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  timelineRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalMinute: {
    width: 34,
    color: colors.accent,
    fontFamily: "SpaceMono",
    fontSize: 10,
  },
  goalScorer: { flex: 1, color: colors.text, fontSize: 11, fontWeight: "700" },
  goalTeam: { color: colors.muted, fontSize: 9 },
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
  readOnlyNoteText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  scheduleButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  scheduleText: { color: colors.accent, fontSize: 10, fontWeight: "800" },
  revertButton: {
    minHeight: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  revertText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});
