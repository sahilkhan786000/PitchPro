import { BlurView } from "expo-blur";
import type { ComponentRef, PropsWithChildren, RefObject } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { colors, radii } from "../theme/tokens";

type AuthGlassPanelProps = PropsWithChildren<{
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  style?: StyleProp<ViewStyle>;
}>;

export function AuthGlassPanel({
  blurTargetRef,
  children,
  style,
}: AuthGlassPanelProps) {
  const { mode } = useAppTheme();
  const glassTint =
    mode === "dark"
      ? "rgba(16,19,24,0.32)"
      : "rgba(245,248,252,0.64)";

  return (
    <BlurView
      blurTarget={blurTargetRef}
      blurMethod="dimezisBlurView"
      intensity={40}
      tint={mode === "dark" ? "dark" : "light"}
      style={[
        styles.panel,
        {
          backgroundColor:
            mode === "dark"
              ? "rgba(16,19,24,0.55)"
              : "rgba(245,248,252,0.76)",
          borderColor:
            mode === "dark"
              ? "rgba(255,255,255,0.16)"
              : "rgba(16,19,24,0.16)",
        },
        style,
      ]}
    >
      {Platform.OS === "web" ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: glassTint },
          ]}
        />
      ) : null}
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
