export interface FinalRuleFixture {
  id: string;
  stage: "league" | "final";
  status: "pending" | "played";
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
}

export interface FinalEligibility {
  leagueGenerated: boolean;
  remainingLeagueMatches: number;
  finalExists: boolean;
  eligible: boolean;
}

export function assessFinalEligibility(
  fixtures: FinalRuleFixture[],
): FinalEligibility {
  const leagueFixtures = fixtures.filter(
    (fixture) => fixture.stage === "league",
  );
  const finalExists = fixtures.some((fixture) => fixture.stage === "final");
  const remainingLeagueMatches = leagueFixtures.filter(
    (fixture) => fixture.status !== "played",
  ).length;
  return {
    leagueGenerated: leagueFixtures.length > 0,
    remainingLeagueMatches,
    finalExists,
    eligible:
      leagueFixtures.length > 0 && remainingLeagueMatches === 0 && !finalExists,
  };
}

export function resolveFinalWinner(
  fixture: FinalRuleFixture | undefined,
): string | null {
  if (!fixture || fixture.stage !== "final" || fixture.status !== "played")
    return null;
  const { home_score: homeScore, away_score: awayScore } = fixture;
  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore === null ||
    awayScore === null ||
    homeScore < 0 ||
    awayScore < 0 ||
    homeScore === awayScore
  )
    return null;
  return homeScore > awayScore ? fixture.home_team_id : fixture.away_team_id;
}
