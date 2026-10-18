export type MatchOutcome = "W" | "D" | "L";

export interface StandingTeam {
  id: string;
  name: string;
}

export interface StandingFixture {
  id: string;
  stage: "league" | "final";
  status: "pending" | "played";
  roundNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  playedAt?: string | null;
}

export interface StandingRow extends StandingTeam {
  position: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  recentForm: MatchOutcome[];
}

interface FormResult {
  fixtureId: string;
  roundNumber: number;
  playedAt: string;
  outcome: MatchOutcome;
}

export function calculateStandings(
  teams: StandingTeam[],
  fixtures: StandingFixture[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const formByTeam = new Map<string, FormResult[]>();

  for (const team of teams) {
    if (rows.has(team.id)) throw new Error(`Duplicate team ID: ${team.id}`);
    rows.set(team.id, {
      ...team,
      position: 0,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      recentForm: [],
    });
    formByTeam.set(team.id, []);
  }

  for (const fixture of fixtures) {
    if (fixture.stage !== "league" || fixture.status !== "played") continue;
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away)
      throw new Error(
        `Fixture ${fixture.id} references a team outside the tournament.`,
      );
    if (
      !Number.isInteger(fixture.homeScore) ||
      !Number.isInteger(fixture.awayScore) ||
      fixture.homeScore === null ||
      fixture.awayScore === null ||
      fixture.homeScore < 0 ||
      fixture.awayScore < 0
    ) {
      throw new Error(
        `Played fixture ${fixture.id} must have non-negative integer scores.`,
      );
    }

    const homeScore = fixture.homeScore;
    const awayScore = fixture.awayScore;
    home.matchesPlayed += 1;
    away.matchesPlayed += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    const homeOutcome: MatchOutcome =
      homeScore > awayScore ? "W" : homeScore === awayScore ? "D" : "L";
    const awayOutcome: MatchOutcome =
      homeScore < awayScore ? "W" : homeScore === awayScore ? "D" : "L";
    if (homeOutcome === "W") {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (homeOutcome === "L") {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }

    const result = {
      fixtureId: fixture.id,
      roundNumber: fixture.roundNumber,
      playedAt: fixture.playedAt ?? "",
    };
    formByTeam.get(home.id)?.push({ ...result, outcome: homeOutcome });
    formByTeam.get(away.id)?.push({ ...result, outcome: awayOutcome });
  }

  const sorted = [...rows.values()].map((row) => {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.recentForm = (formByTeam.get(row.id) ?? [])
      .sort(
        (left, right) =>
          left.playedAt.localeCompare(right.playedAt) ||
          left.roundNumber - right.roundNumber ||
          left.fixtureId.localeCompare(right.fixtureId),
      )
      .slice(-5)
      .map((result) => result.outcome);
    return row;
  });

  sorted.sort((left, right) => {
    const leftName = left.name.toLowerCase();
    const rightName = right.name.toLowerCase();
    const nameOrder = leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
    return (
      right.points - left.points ||
      right.goalDifference - left.goalDifference ||
      right.goalsFor - left.goalsFor ||
      nameOrder ||
      left.id.localeCompare(right.id)
    );
  });

  sorted.forEach((row, index) => {
    row.position = index + 1;
  });
  return sorted;
}
