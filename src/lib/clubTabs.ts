export function getHomeTabHref(club: { id?: string } | null | undefined) {
  return club ? null : undefined;
}

export function getClubTabHref(club: { id?: string } | null | undefined) {
  return club ? undefined : null;
}
