import { describe, expect, it } from "vitest";

import {
  applyTheme,
  colors,
  createThemedStyles,
  darkColors,
  lightColors,
} from "./tokens";

describe("theme tokens", () => {
  it("uses a dark default and switches to a light palette with blue accents", () => {
    expect(colors.background).toBe(darkColors.background);
    expect(colors.accent).toBe(darkColors.accent);

    applyTheme("light");
    expect(colors.background).toBe(lightColors.background);
    expect(colors.text).toBe(lightColors.text);
    expect(colors.accent).toBe(lightColors.accent);

    applyTheme("dark");
    expect(colors.background).toBe(darkColors.background);
    expect(colors.accent).toBe(darkColors.accent);
  });

  it("updates colors read from themed styles when the palette changes", () => {
    applyTheme("dark");
    const styles = createThemedStyles({
      page: { backgroundColor: darkColors.background },
      title: { color: darkColors.text },
    });

    applyTheme("light");
    expect(styles.page.backgroundColor).toBe(lightColors.background);
    expect(styles.title.color).toBe(lightColors.text);

    applyTheme("dark");
    expect(styles.page.backgroundColor).toBe(darkColors.background);
  });

  it("restores dark colors for styles created after selecting light mode", () => {
    applyTheme("light");
    const styles = createThemedStyles({
      page: { backgroundColor: colors.background },
      title: { color: colors.text },
      accent: { color: colors.accent },
    });

    applyTheme("dark");
    expect(styles.page.backgroundColor).toBe(darkColors.background);
    expect(styles.title.color).toBe(darkColors.text);
    expect(styles.accent.color).toBe(darkColors.accent);

    applyTheme("dark");
  });
});
