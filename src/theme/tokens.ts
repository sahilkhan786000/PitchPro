import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

export type ThemeMode = "dark" | "light";

export const darkColors = {
  background: "#101318",
  surface: "#1C2028",
  elevated: "#262B35",
  border: "#343A45",
  accent: "#39E879",
  blue: "#39B6FF",
  text: "#F7F8FA",
  muted: "#A8AFBC",
  dim: "#737B88",
  success: "#2DBE69",
  danger: "#F04444",
  draw: "#9297A2",
  gold: "#F6C85F",
};

export const lightColors = {
  background: "#F5F8FC",
  surface: "#FFFFFF",
  elevated: "#EAF3FF",
  border: "#D4DEEE",
  accent: "#5BA7FF",
  blue: "#5BA7FF",
  text: "#101318",
  muted: "#4C5870",
  dim: "#687589",
  success: "#2E9D6F",
  danger: "#D64545",
  draw: "#6D7A8B",
  gold: "#D89A2B",
};

export const colors = { ...darkColors };

let activeTheme: ThemeMode = "dark";

const lightColorByDark = new Map<string, string>([
  ...Object.entries(darkColors).map(
    ([token, color]) =>
      [color, lightColors[token as keyof typeof lightColors]] as const,
  ),
  ["#273B2F", "#E4F2E8"],
  ["#3A5141", "#C7D9CC"],
  ["#22362A", "#E2F4E8"],
  ["#3D8052", "#8FBF9B"],
  ["#21372B", "#E4F2E8"],
  ["#385343", "#D0E5D7"],
  ["#18251E", "#E7F1EA"],
  ["#1B2E23", "#E3F1E7"],
  ["#31563C", "#A8CBB0"],
  ["#294333", "#CDE8D5"],
  ["#3A3424", "#F7ECCC"],
  ["#52492B", "#D9C99A"],
  ["#28271F", "#F5F1E4"],
  ["#3B3522", "#EEE4C8"],
  ["#2B281D", "#F2EBD9"],
  ["#5B4E2D", "#D8C892"],
  ["#302B1F", "#F2E9D3"],
  ["#61532E", "#D6C58E"],
  ["#29261D", "#F4EFDF"],
  ["#0B0E11", lightColors.background],
  ["#171B20", lightColors.surface],
  ["#303741", lightColors.border],
  ["#253328", "#DCEBE0"],
  ["#23382C", "#DDEDE2"],
  ["#3D4147", lightColors.border],
  ["#3A2225", "#FCE8E9"],
  ["#57373A", "#FCE8E9"],
  ["#281E21", "#FCE8E9"],
  ["#FFB6BA", "#8C2F39"],
]);

const darkColorByLight = new Map<string, string>(
  Object.entries(lightColors).map(([token, color]) => [
    color,
    darkColors[token as keyof typeof darkColors],
  ]),
);
darkColorByLight.set(lightColors.accent, darkColors.accent);
for (const [darkColor, lightColor] of lightColorByDark) {
  if (!darkColorByLight.has(lightColor)) {
    darkColorByLight.set(lightColor, darkColor);
  }
}

const themedStyleCache = new WeakMap<
  object,
  Partial<Record<ThemeMode, object>>
>();

function resolveThemedValue(
  value: unknown,
  sourceTheme: ThemeMode,
  targetTheme: ThemeMode,
): unknown {
  if (typeof value === "string") {
    if (sourceTheme === targetTheme) return value;
    return sourceTheme === "dark"
      ? (lightColorByDark.get(value) ?? value)
      : (darkColorByLight.get(value) ?? value);
  }
  if (value === null || typeof value !== "object") return value;

  const cached = themedStyleCache.get(value)?.[targetTheme];
  if (cached) return cached;

  if (Array.isArray(value)) {
    const themedValue = value.map((item) =>
      resolveThemedValue(item, sourceTheme, targetTheme),
    );
    themedStyleCache.set(value, {
      ...themedStyleCache.get(value),
      [targetTheme]: themedValue,
    });
    return themedValue;
  }
  const themedValue = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      resolveThemedValue(item, sourceTheme, targetTheme),
    ]),
  );
  themedStyleCache.set(value, {
    ...themedStyleCache.get(value),
    [targetTheme]: themedValue,
  });
  return themedValue;
}

type NamedStyles<T> = {
  [Key in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export function createThemedStyles<T extends NamedStyles<T>>(styles: T): T {
  const sourceTheme = activeTheme;
  return new Proxy(styles, {
    get(target, property, receiver) {
      return resolveThemedValue(
        Reflect.get(target, property, receiver),
        sourceTheme,
        activeTheme,
      );
    },
  });
}

export function applyTheme(mode: ThemeMode) {
  activeTheme = mode;
  const nextColors = mode === "dark" ? darkColors : lightColors;
  Object.assign(colors, nextColors);
}

export function getThemeColors(mode: ThemeMode) {
  return mode === "dark" ? darkColors : lightColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radii = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
