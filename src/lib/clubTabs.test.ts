import { describe, expect, it } from "vitest";

import { getClubTabHref, getHomeTabHref } from "./clubTabs";

describe("club tab visibility", () => {
  it("hides the Home tab when a club is active and keeps club tabs hidden without one", () => {
    expect(getHomeTabHref({ id: "club-1" })).toBeNull();
    expect(getHomeTabHref(null)).toBeUndefined();
    expect(getClubTabHref({ id: "club-1" })).toBeUndefined();
    expect(getClubTabHref(null)).toBeNull();
  });
});
