import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Rect } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "@/src/theme/ThemeContext";
import { getThemeColors, radii, spacing } from "@/src/theme/tokens";

export function ClubMatchdayFooter() {
  const { mode } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const glow = useSharedValue(0);
  const [pitchWidth, setPitchWidth] = useState(0);
  const palette = getThemeColors(mode);

  useEffect(() => {
    if (reduceMotion) return;

    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(progress);
      cancelAnimation(glow);
    };
  }, [glow, progress, reduceMotion]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? Math.max(0, pitchWidth * 0.42)
          : interpolate(
              progress.value,
              [0, 1],
              [0, Math.max(0, pitchWidth * 0.42)],
            ),
      },
      { rotate: `${progress.value * 720}deg` },
      {
        translateY: reduceMotion
          ? 0
          : interpolate(
              Math.sin(progress.value * Math.PI * 8),
              [-1, 1],
              [0, -3],
            ),
      },
    ],
  }));
  const goalStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.8 : interpolate(glow.value, [0, 1], [0.42, 1]),
    transform: [{ scale: reduceMotion ? 1 : interpolate(glow.value, [0, 1], [0.94, 1.06]) }],
  }));

  return (
    <View
      accessible
      accessibilityLabel="Animated mini football pitch. Your Club, your season."
      style={[
        styles.card,
        { borderColor: palette.border, backgroundColor: palette.surface },
      ]}
    >
      <LinearGradient
        colors={
          mode === "dark"
            ? ["rgba(57,232,121,0.08)", "rgba(28,32,40,0)"]
            : ["rgba(91,167,255,0.12)", "rgba(255,255,255,0)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>
          MATCHDAY STARTS HERE
        </Text>
        <Text style={[styles.title, { color: palette.text }]}>
          Your Club, your season.
        </Text>
      </View>
      <View
        onLayout={(event) => setPitchWidth(event.nativeEvent.layout.width)}
        style={[
          styles.pitch,
          { borderColor: `${palette.accent}88`, backgroundColor: `${palette.accent}12` },
        ]}
      >
        <Svg width="100%" height="100%" style={styles.pitchLines}>
          <Rect
            x="1"
            y="1"
            width="98%"
            height="94%"
            rx="7"
            fill="none"
            stroke={`${palette.accent}70`}
            strokeWidth="1"
          />
          <Line
            x1="50%"
            y1="1"
            x2="50%"
            y2="95%"
            stroke={`${palette.accent}70`}
            strokeWidth="1"
          />
          <Circle
            cx="50%"
            cy="48%"
            r="8"
            fill="none"
            stroke={`${palette.accent}70`}
            strokeWidth="1"
          />
          <Rect
            x="91%"
            y="28%"
            width="8%"
            height="42%"
            fill="none"
            stroke={`${palette.accent}70`}
            strokeWidth="1"
          />
        </Svg>
        <Animated.View style={[styles.goalGlow, goalStyle]} />
        <Animated.View style={[styles.ball, ballStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 24 24">
            <Circle cx="12" cy="12" r="10.5" fill="#FFFFFF" stroke="#15211A" strokeWidth="1.5" />
            <Polygon points="12,7 15,9 14,13 10,13 9,9" fill="#17211B" />
            <Polygon points="2.5,9 6.5,8 8,11 5.5,14 2,13" fill="#17211B" />
            <Polygon points="17.5,8 21.5,9 22,13 18.5,14 16,11" fill="#17211B" />
            <Polygon points="7,16 10,14 14,14 17,16 15,20 9,20" fill="#17211B" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 84,
    marginTop: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  copy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  title: { fontSize: 12, fontWeight: "800" },
  pitch: {
    width: 108,
    height: 64,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  pitchLines: { ...StyleSheet.absoluteFill },
  goalGlow: {
    position: "absolute",
    right: 1,
    top: "28%",
    width: 4,
    height: "42%",
    borderRadius: 2,
    backgroundColor: "#F6C85F",
  },
  ball: {
    position: "absolute",
    left: "50%",
    marginLeft: -10,
    top: "50%",
    marginTop: -10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
