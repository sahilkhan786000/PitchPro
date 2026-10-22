import { supabase } from "../../lib/supabase";
import { generateDoubleRoundRobin } from "../fixtures/roundRobin";

export interface TournamentSummary {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed";
  owner_id: string;
  created_at: string;
  teams: Array<{ id: string; name: string; logo_path: string | null }>;
}

export interface TeamRecord {
  id: string;
  name: string;
  logo_path: string | null;
  created_at: string;
  owner_id: string;
}

export interface TournamentFixture {
  id: string;
  tournament_id: string;
  matchday_id: string | null;
  home_team_id: string;
  away_team_id: string;
  updated_at: string;
  stage: "league" | "final";
  status: "pending" | "played";
  scheduled_at: string | null;
  played_at: string | null;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  notes_image_path: string | null;
  version: number;
  goal_events?: TournamentGoalEvent[];
  matchdays: { round_number: number } | null;
}

export interface TournamentGoalEvent {
  id: string;
  team_id: string;
  scorer_name: string | null;
  minute: number | null;
  goal_type: "regular" | "penalty" | "own_goal";
}

function requireSupabase() {
  if (!supabase) throw new Error("Connect Supabase to load PitchPro data.");
  return supabase;
}

export async function listTournaments(
  clubId: string,
): Promise<TournamentSummary[]> {
  if (!clubId) return [];
  const client = requireSupabase();
  const { data: tournaments, error } = await client
    .from("tournaments")
    .select("id, name, description, status, owner_id, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!tournaments?.length) return [];

  const ids = tournaments.map((tournament) => tournament.id);
  const { data: memberships, error: membershipsError } = await client
    .from("tournament_teams")
    .select("tournament_id, teams(id, name, logo_path)")
    .in("tournament_id", ids);
  if (membershipsError) throw membershipsError;

  const teamsByTournament = new Map<string, TournamentSummary["teams"]>();
  for (const membership of (memberships ?? []) as unknown as Array<{
    tournament_id: string;
    teams: { id: string; name: string; logo_path: string | null } | null;
  }>) {
    if (!membership.teams) continue;
    const teams = teamsByTournament.get(membership.tournament_id) ?? [];
    teams.push(membership.teams);
    teamsByTournament.set(membership.tournament_id, teams);
  }

  return tournaments.map((tournament) => ({
    ...tournament,
    status: tournament.status as TournamentSummary["status"],
    teams: teamsByTournament.get(tournament.id) ?? [],
  }));
}

export async function listTeams(
  clubId: string,
  ownerId?: string,
): Promise<TeamRecord[]> {
  if (!clubId) return [];
  const client = requireSupabase();
  let query = client
    .from("teams")
    .select("id, name, logo_path, created_at, owner_id")
    .eq("club_id", clubId)
    .order("name", { ascending: true });
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TeamRecord[];
}

export async function getSignedLogoUrl(
  bucket: "team-logos" | "tournament-logos",
  path: string,
) {
  const client = requireSupabase();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function getSignedMatchNoteUrl(path: string) {
  const client = requireSupabase();
  const { data, error } = await client.storage
    .from("match-notes")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeMatchNoteImage(path: string) {
  const client = requireSupabase();
  const { error } = await client.storage.from("match-notes").remove([path]);
  if (error) throw error;
}

export async function createTeam(
  clubId: string,
  name: string,
  logoPath: string | null,
): Promise<TeamRecord> {
  if (!clubId) throw new Error("Join a Club before creating a team.");
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_team", {
    p_club_id: clubId,
    p_name: name.trim(),
    p_logo_path: logoPath,
  });
  if (error) throw error;
  return data as TeamRecord;
}

export async function deleteTeam(teamId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
}

export async function createTournament(input: {
  clubId: string;
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  teamIds: string[];
}): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_tournament_with_teams", {
    p_club_id: input.clubId,
    p_name: input.name,
    p_description: input.description || null,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_timezone: input.timezone,
    p_team_ids: input.teamIds,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteTournament(tournamentId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_tournament", {
    p_tournament_id: tournamentId,
  });
  if (error) throw error;
}

export async function removeTournamentTeam(
  tournamentId: string,
  teamId: string,
) {
  const client = requireSupabase();
  const { error } = await client.rpc("remove_tournament_team", {
    p_tournament_id: tournamentId,
    p_team_id: teamId,
  });
  if (error) throw error;
}

export async function deleteTournamentFixture(fixtureId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_tournament_fixture", {
    p_fixture_id: fixtureId,
  });
  if (error) throw error;
}

export async function getTournament(id: string) {
  if (!id) throw new Error("Tournament ID is required.");
  const client = requireSupabase();

  // 1. Fetch tournament details (with fallback for optional columns)
  let tournamentData: any = null;
  const tournamentQuery = await client
    .from("tournaments")
    .select(
      "id, name, description, status, owner_id, created_at, start_date, end_date, timezone",
    )
    .eq("id", id)
    .maybeSingle();

  if (tournamentQuery.error) {
    const basicQuery = await client
      .from("tournaments")
      .select("id, name, description, status, owner_id, created_at")
      .eq("id", id)
      .maybeSingle();
    if (basicQuery.error) throw basicQuery.error;
    if (!basicQuery.data) throw new Error("Tournament not found.");
    tournamentData = {
      ...basicQuery.data,
      start_date: null,
      end_date: null,
      timezone: "UTC",
    };
  } else {
    if (!tournamentQuery.data) throw new Error("Tournament not found.");
    tournamentData = tournamentQuery.data;
  }

  // 2. Fetch teams and fixtures concurrently
  const [teamResult, fixtureResult] = await Promise.all([
    client
      .from("tournament_teams")
      .select("team_id, teams(id, name, logo_path)")
      .eq("tournament_id", id),
    client
      .from("fixtures")
      .select(
        "id, tournament_id, matchday_id, home_team_id, away_team_id, stage, status, scheduled_at, played_at, home_score, away_score, notes, notes_image_path, version, updated_at, matchdays(round_number)",
      )
      .eq("tournament_id", id),
  ]);

  // Process teams with fallback
  let teamsList: Array<{ id: string; name: string; logo_path: string | null }> = [];
  if (teamResult.error) {
    const ttFallback = await client
      .from("tournament_teams")
      .select("team_id")
      .eq("tournament_id", id);
    if (!ttFallback.error && ttFallback.data?.length) {
      const teamIds = ttFallback.data.map((row) => row.team_id);
      const teamsFallback = await client
        .from("teams")
        .select("id, name, logo_path")
        .in("id", teamIds);
      if (!teamsFallback.error && teamsFallback.data) {
        teamsList = teamsFallback.data;
      }
    }
  } else if (teamResult.data) {
    const members = teamResult.data as unknown as Array<{
      team_id: string;
      teams: { id: string; name: string; logo_path: string | null } | null;
    }>;
    teamsList = members.flatMap((member) => (member.teams ? [member.teams] : []));
  }

  // Deduplicate teams by ID to ensure calculateStandings never encounters duplicates
  const teamMap = new Map<string, { id: string; name: string; logo_path: string | null }>();
  for (const team of teamsList) {
    if (team?.id && !teamMap.has(team.id)) {
      teamMap.set(team.id, team);
    }
  }
  const deduplicatedTeams = Array.from(teamMap.values());

  // Process fixtures with fallback for matchdays relation
  let fixtureRows: any[] = [];
  if (fixtureResult.error) {
    const fallbackFixtures = await client
      .from("fixtures")
      .select(
        "id, tournament_id, matchday_id, home_team_id, away_team_id, stage, status, scheduled_at, played_at, home_score, away_score, notes, notes_image_path, version, updated_at",
      )
      .eq("tournament_id", id);
    if (!fallbackFixtures.error && fallbackFixtures.data) {
      fixtureRows = fallbackFixtures.data.map((fixture: any) => ({
        ...fixture,
        matchdays: null,
      }));
    }
  } else if (fixtureResult.data) {
    fixtureRows = fixtureResult.data;
  }

  // 3. Fetch goal events if there are fixtures
  const fixtureIds = fixtureRows.map((fixture) => fixture.id);
  const goalsByFixture = new Map<string, TournamentGoalEvent[]>();
  if (fixtureIds.length) {
    try {
      const goalsResult = await client
        .from("goal_events")
        .select("id, fixture_id, team_id, scorer_name, minute, goal_type")
        .in("fixture_id", fixtureIds);
      if (!goalsResult.error && goalsResult.data) {
        for (const event of goalsResult.data as Array<
          TournamentGoalEvent & { fixture_id: string }
        >) {
          const events = goalsByFixture.get(event.fixture_id) ?? [];
          events.push(event);
          goalsByFixture.set(event.fixture_id, events);
        }
      }
    } catch {
      // Gracefully continue without goal events if query fails
    }
  }

  return {
    tournament: tournamentData,
    teams: deduplicatedTeams,
    fixtures: fixtureRows.map((fixture) => ({
      ...fixture,
      goal_events: goalsByFixture.get(fixture.id) ?? [],
    })) as unknown as TournamentFixture[],
  };
}

export async function generateFixtures(
  tournamentId: string,
  teams: Array<{ id: string; name: string }>,
) {
  const client = requireSupabase();
  const fixtures = generateDoubleRoundRobin(teams).map((fixture) => ({
    round_number: fixture.roundNumber,
    home_team_id: fixture.homeTeamId,
    away_team_id: fixture.awayTeamId,
  }));
  const { data, error } = await client.rpc("generate_league_fixtures", {
    p_tournament_id: tournamentId,
    p_fixtures: fixtures,
  });
  if (error) throw error;
  return data as number;
}

export interface GoalEventInput {
  team_id: string;
  scorer_name?: string | null;
  minute?: number | null;
  goal_type?: "regular" | "penalty" | "own_goal";
}

export async function saveFixtureResult(input: {
  fixtureId: string;
  expectedVersion: number;
  status: "pending" | "played";
  homeScore: number | null;
  awayScore: number | null;
  goalEvents: GoalEventInput[];
  notes: string;
  notesImagePath: string | null;
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("save_fixture_result_with_image", {
    p_fixture_id: input.fixtureId,
    p_expected_version: input.expectedVersion,
    p_status: input.status,
    p_home_score: input.homeScore,
    p_away_score: input.awayScore,
    p_goal_events: input.goalEvents,
    p_notes: input.notes,
    p_notes_image_path: input.notesImagePath,
  });
  if (error) throw error;
  return data as TournamentFixture;
}

export async function scheduleFixture(input: {
  fixtureId: string;
  expectedVersion: number;
  scheduledAt: string | null;
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("schedule_fixture", {
    p_fixture_id: input.fixtureId,
    p_expected_version: input.expectedVersion,
    p_scheduled_at: input.scheduledAt,
  });
  if (error) throw error;
  return data as TournamentFixture;
}

export async function createFinal(tournamentId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_tournament_final", {
    p_tournament_id: tournamentId,
  });
  if (error) throw error;
  return data as TournamentFixture;
}

export async function listActivity(tournamentId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("activity_events")
    .select("id, event_type, entity_type, entity_id, metadata, created_at")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export function subscribeToTournament(
  tournamentId: string,
  onUpdate: () => void,
) {
  const client = requireSupabase();
  const subscriptionId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const channel = client
    .channel(`tournament:${tournamentId}:${subscriptionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "fixtures",
        filter: `tournament_id=eq.${tournamentId}`,
      },
      onUpdate,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "activity_events",
        filter: `tournament_id=eq.${tournamentId}`,
      },
      onUpdate,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export async function createTournamentInvite(tournamentId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_tournament_invite", {
    p_tournament_id: tournamentId,
    p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  return data as string;
}

export async function acceptTournamentInvite(token: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("accept_tournament_invite", {
    p_token: token,
  });
  if (error) throw error;
  return data as string;
}

export async function listTournamentInvitations(tournamentId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tournament_invitations")
    .select("id, expires_at, accepted_at, revoked_at, created_at")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokeTournamentInvite(invitationId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("revoke_tournament_invite", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function listTournamentMembers(tournamentId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tournament_members")
    .select("user_id, role, joined_at, profiles(full_name)")
    .eq("tournament_id", tournamentId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function revokeTournamentMember(
  tournamentId: string,
  userId: string,
) {
  const client = requireSupabase();
  const { error } = await client.rpc("revoke_tournament_member", {
    p_tournament_id: tournamentId,
    p_user_id: userId,
  });
  if (error) throw error;
}
