export interface FixtureTeam {
  id: string;
  name: string;
}

export interface GeneratedFixture {
  roundNumber: number;
  leg: 1 | 2;
  homeTeamId: string;
  awayTeamId: string;
}

export interface CompetitionCounts {
  fixtureCount: number;
  matchdayCount: number;
  matchesPerTeam: number;
  matchesPerMatchday: number;
}

export function getCompetitionCounts(teamCount: number): CompetitionCounts {
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    throw new RangeError("A league requires at least two teams.");
  }

  return {
    fixtureCount: teamCount * (teamCount - 1),
    matchdayCount: teamCount % 2 === 0 ? 2 * (teamCount - 1) : 2 * teamCount,
    matchesPerTeam: 2 * (teamCount - 1),
    matchesPerMatchday: Math.floor(teamCount / 2),
  };
}

export function generateDoubleRoundRobin(
  teams: FixtureTeam[],
): GeneratedFixture[] {
  getCompetitionCounts(teams.length);
  const ids = new Set(teams.map((team) => team.id));
  if (ids.size !== teams.length || teams.some((team) => !team.id.trim())) {
    throw new Error("Teams must have unique, non-empty IDs.");
  }

  const ring: Array<FixtureTeam | null> = [...teams];
  if (ring.length % 2 !== 0) ring.push(null);

  const firstLeg: GeneratedFixture[][] = [];
  const singleLegRounds = ring.length - 1;

  for (let round = 0; round < singleLegRounds; round += 1) {
    const matches: GeneratedFixture[] = [];
    for (let index = 0; index < ring.length / 2; index += 1) {
      const first = ring[index];
      const second = ring[ring.length - 1 - index];
      if (!first || !second) continue;

      const swapHome = (round + index) % 2 === 1;
      matches.push({
        roundNumber: round + 1,
        leg: 1,
        homeTeamId: swapHome ? second.id : first.id,
        awayTeamId: swapHome ? first.id : second.id,
      });
    }
    firstLeg.push(matches);

    const fixed = ring[0];
    const rotated = ring.slice(1);
    rotated.unshift(rotated.pop() ?? null);
    ring.splice(0, ring.length, fixed, ...rotated);
  }

  const fixtures = [...firstLeg.flat()];
  for (const matches of firstLeg) {
    const roundNumber = matches[0]?.roundNumber;
    if (roundNumber === undefined) continue;
    for (const match of matches) {
      fixtures.push({
        roundNumber: roundNumber + singleLegRounds,
        leg: 2,
        homeTeamId: match.awayTeamId,
        awayTeamId: match.homeTeamId,
      });
    }
  }

  return fixtures;
}
