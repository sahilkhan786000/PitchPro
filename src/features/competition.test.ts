import { describe, expect, it } from "vitest";

import { assessFinalEligibility, resolveFinalWinner } from "./finals/rules";
import {
  generateDoubleRoundRobin,
  getCompetitionCounts,
} from "./fixtures/roundRobin";
import {
  calculateStandings,
  type StandingFixture,
} from "./standings/calculateStandings";

function createTeams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${String.fromCharCode(65 + index)}`,
  }));
}

describe("double round-robin generation", () => {
  it.each([2, 3, 4, 5, 6, 10])(
    "schedules every pair home and away for %i teams",
    (count) => {
      const teams = createTeams(count);
      const fixtures = generateDoubleRoundRobin(teams);
      const expected = getCompetitionCounts(count);
      const pairings = new Map<string, { home: number; away: number }>();
      const matchdayTeams = new Map<number, Set<string>>();
      const teamMatches = new Map(teams.map((team) => [team.id, 0]));

      expect(fixtures).toHaveLength(expected.fixtureCount);
      expect(
        new Set(
          fixtures.map(
            (fixture) =>
              `${fixture.roundNumber}:${fixture.homeTeamId}:${fixture.awayTeamId}`,
          ),
        ).size,
      ).toBe(fixtures.length);

      for (const fixture of fixtures) {
        const orderedPair = [fixture.homeTeamId, fixture.awayTeamId].sort();
        const key = orderedPair.join(":");
        const pair = pairings.get(key) ?? { home: 0, away: 0 };
        if (fixture.homeTeamId === orderedPair[0]) pair.home += 1;
        else pair.away += 1;
        pairings.set(key, pair);
        teamMatches.set(
          fixture.homeTeamId,
          (teamMatches.get(fixture.homeTeamId) ?? 0) + 1,
        );
        teamMatches.set(
          fixture.awayTeamId,
          (teamMatches.get(fixture.awayTeamId) ?? 0) + 1,
        );

        const activeTeams =
          matchdayTeams.get(fixture.roundNumber) ?? new Set<string>();
        expect(activeTeams.has(fixture.homeTeamId)).toBe(false);
        expect(activeTeams.has(fixture.awayTeamId)).toBe(false);
        activeTeams.add(fixture.homeTeamId);
        activeTeams.add(fixture.awayTeamId);
        matchdayTeams.set(fixture.roundNumber, activeTeams);
      }

      expect(pairings.size).toBe((count * (count - 1)) / 2);
      expect(
        [...pairings.values()].every(
          (pair) => pair.home === 1 && pair.away === 1,
        ),
      ).toBe(true);
      expect(
        [...teamMatches.values()].every(
          (matches) => matches === expected.matchesPerTeam,
        ),
      ).toBe(true);
      expect(matchdayTeams.size).toBe(expected.matchdayCount);
      expect(generateDoubleRoundRobin(teams)).toEqual(fixtures);
    },
  );

  it("creates 12 league fixtures over 6 matchdays for four teams", () => {
    const fixtures = generateDoubleRoundRobin(createTeams(4));
    expect(fixtures).toHaveLength(12);
    expect(new Set(fixtures.map((fixture) => fixture.roundNumber)).size).toBe(
      6,
    );
    expect(
      fixtures.filter((fixture) => fixture.roundNumber === 1),
    ).toHaveLength(2);
    expect(
      fixtures.filter((fixture) => fixture.roundNumber === 6),
    ).toHaveLength(2);
  });

  it("rejects fewer than two teams and duplicate team IDs", () => {
    expect(() => generateDoubleRoundRobin(createTeams(1))).toThrow(RangeError);
    expect(() =>
      generateDoubleRoundRobin([
        { id: "same", name: "A" },
        { id: "same", name: "B" },
      ]),
    ).toThrow();
  });
});

describe("standings calculation", () => {
  const teams = createTeams(4);
  const fixtures: StandingFixture[] = [
    {
      id: "one",
      stage: "league",
      status: "played",
      roundNumber: 1,
      homeTeamId: teams[0].id,
      awayTeamId: teams[1].id,
      homeScore: 2,
      awayScore: 0,
      playedAt: "2026-01-01",
    },
    {
      id: "two",
      stage: "league",
      status: "played",
      roundNumber: 1,
      homeTeamId: teams[2].id,
      awayTeamId: teams[3].id,
      homeScore: 1,
      awayScore: 1,
      playedAt: "2026-01-02",
    },
    {
      id: "three",
      stage: "league",
      status: "played",
      roundNumber: 2,
      homeTeamId: teams[1].id,
      awayTeamId: teams[2].id,
      homeScore: 0,
      awayScore: 3,
      playedAt: "2026-01-03",
    },
    {
      id: "pending",
      stage: "league",
      status: "pending",
      roundNumber: 2,
      homeTeamId: teams[0].id,
      awayTeamId: teams[2].id,
      homeScore: null,
      awayScore: null,
    },
    {
      id: "final",
      stage: "final",
      status: "played",
      roundNumber: 7,
      homeTeamId: teams[0].id,
      awayTeamId: teams[2].id,
      homeScore: 99,
      awayScore: 0,
      playedAt: "2026-01-04",
    },
  ];

  it("counts only played league fixtures and includes teams with no results", () => {
    const table = calculateStandings(teams, fixtures);
    const teamA = table.find((row) => row.id === teams[0].id)!;
    const teamB = table.find((row) => row.id === teams[1].id)!;
    const teamC = table.find((row) => row.id === teams[2].id)!;
    const teamD = table.find((row) => row.id === teams[3].id)!;

    expect(teamA).toMatchObject({
      matchesPlayed: 1,
      wins: 1,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDifference: 2,
      points: 3,
    });
    expect(teamB).toMatchObject({
      matchesPlayed: 2,
      wins: 0,
      losses: 2,
      points: 0,
    });
    expect(teamC).toMatchObject({
      matchesPlayed: 2,
      wins: 1,
      draws: 1,
      points: 4,
    });
    expect(teamD).toMatchObject({ matchesPlayed: 1, draws: 1, points: 1 });
    expect(table.map((row) => row.position)).toEqual([1, 2, 3, 4]);
  });

  it("updates table and recent form when a result changes or is reverted", () => {
    const changed = fixtures.map((fixture) =>
      fixture.id === "one"
        ? { ...fixture, homeScore: 0, awayScore: 1 }
        : fixture,
    );
    const afterCorrection = calculateStandings(teams, changed);
    expect(afterCorrection.find((row) => row.id === teams[1].id)?.points).toBe(
      3,
    );
    expect(
      afterCorrection.find((row) => row.id === teams[0].id)?.recentForm,
    ).toEqual(["L"]);

    const reverted = changed.map((fixture) =>
      fixture.id === "one"
        ? {
            ...fixture,
            status: "pending" as const,
            homeScore: null,
            awayScore: null,
          }
        : fixture,
    );
    expect(
      calculateStandings(teams, reverted).find((row) => row.id === teams[0].id)
        ?.matchesPlayed,
    ).toBe(0);
  });

  it("breaks ties deterministically by goal difference, goals scored, then name", () => {
    const tiedTeams = [
      { id: "b", name: "Beta" },
      { id: "a", name: "Alpha" },
    ];
    expect(calculateStandings(tiedTeams, []).map((row) => row.name)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });
});

describe("final eligibility and winner resolution", () => {
  const leagueMatch = {
    id: "league-1",
    stage: "league" as const,
    status: "played" as const,
    home_team_id: "team-1",
    away_team_id: "team-2",
    home_score: 2,
    away_score: 1,
  };

  it("requires a generated and fully played league, and prevents duplicates", () => {
    expect(assessFinalEligibility([])).toMatchObject({
      leagueGenerated: false,
      eligible: false,
    });
    expect(
      assessFinalEligibility([{ ...leagueMatch, status: "pending" }]),
    ).toMatchObject({
      remainingLeagueMatches: 1,
      eligible: false,
    });
    expect(assessFinalEligibility([leagueMatch]).eligible).toBe(true);
    expect(
      assessFinalEligibility([
        leagueMatch,
        { ...leagueMatch, id: "final-1", stage: "final" as const },
      ]),
    ).toMatchObject({ finalExists: true, eligible: false });
  });

  it("resolves decisive final scores and leaves draws unresolved", () => {
    const final = { ...leagueMatch, id: "final-1", stage: "final" as const };
    expect(resolveFinalWinner(final)).toBe("team-1");
    expect(resolveFinalWinner({ ...final, home_score: 0, away_score: 3 })).toBe(
      "team-2",
    );
    expect(
      resolveFinalWinner({ ...final, home_score: 1, away_score: 1 }),
    ).toBeNull();
    expect(resolveFinalWinner({ ...final, status: "pending" })).toBeNull();
    expect(resolveFinalWinner({ ...final, home_score: null })).toBeNull();
  });
});
