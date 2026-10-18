import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { applyTheme, colors, type ThemeMode } from "./tokens";

type AppThemeContextValue = {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  colors: typeof colors;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  const setMode = (nextMode: ThemeMode) => {
    applyTheme(nextMode);
    setModeState(nextMode);
  };
  const toggleTheme = () => setMode(mode === "dark" ? "light" : "dark");

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      colors,
      toggleTheme,
      setMode,
    }),
    [mode],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used inside AppThemeProvider.");
  }
  return context;
}

export function useThemeRefresh() {
  useAppTheme();
}
