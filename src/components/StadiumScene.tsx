import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Ellipse,
  Line,
  Polygon,
  Polyline,
  Rect,
} from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useAppTheme } from "@/src/theme/ThemeContext";
import { createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const playerPositions = [12, 28, 40, 60, 72, 88] as const;

export function StadiumScene() {
  const { mode } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const movement = useSharedValue(0);
  const gameBeat = useSharedValue(0);
  const sceneWidth = Math.max(width - spacing.md * 2, 260);

  useEffect(() => {
    if (reduceMotion) return;
    movement.value = withRepeat(
      withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    gameBeat.value = withRepeat(
      withTiming(1, { duration: 6400, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(movement);
      cancelAnimation(gameBeat);
    };
  }, [gameBeat, movement, reduceMotion]);

  const leftBeamStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 0.4
      : interpolate(movement.value, [0, 1], [0.28, 0.62]),
    transform: [
      {
        translateX: reduceMotion
          ? -14
          : interpolate(movement.value, [0, 1], [-30, 34]),
      },
      {
        rotate: reduceMotion
          ? "-15deg"
          : `${interpolate(movement.value, [0, 1], [-22, -8])}deg`,
      },
    ],
  }));
  const rightBeamStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 0.35
      : interpolate(movement.value, [0, 1], [0.5, 0.24]),
    transform: [
      {
        translateX: reduceMotion
          ? 15
          : interpolate(movement.value, [0, 1], [28, -36]),
      },
      {
        rotate: reduceMotion
          ? "14deg"
          : `${interpolate(movement.value, [0, 1], [20, 7])}deg`,
      },
    ],
  }));
  const ballStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 1
      : interpolate(gameBeat.value, [0, 0.57, 0.64, 0.82, 0.9, 1], [1, 1, 1, 0.25, 1, 1]),
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(gameBeat.value, [0, 0.57, 0.64, 0.82, 0.9, 1], [0, 0, sceneWidth * 0.42, sceneWidth * 0.42, 0, 0]),
      },
      {
        translateY: reduceMotion
          ? 0
          : interpolate(gameBeat.value, [0, 0.57, 0.64, 0.73, 0.82, 0.9, 1], [0, 0, -10, -32, -12, 0, 0]),
      },
      {
        rotate: reduceMotion
          ? "0deg"
          : `${interpolate(gameBeat.value, [0, 0.64, 0.82, 1], [0, 0, 540, 0])}deg`,
      },
    ],
  }));

  const palette =
    mode === "dark"
      ? {
          gradient: ["#111C23", "#13271F", "#0B1515"] as const,
          glow: "#DFFFE8",
          beamLeft: ["rgba(219,255,227,0.42)", "rgba(57,232,121,0.12)", "transparent"] as const,
          beamRight: ["rgba(232,249,255,0.38)", "rgba(57,182,255,0.11)", "transparent"] as const,
          line: "rgba(218,255,225,0.76)",
          turf: "rgba(23,112,61,0.58)",
          ball: "#F6F8F3",
          ballMark: "#17211A",
          redKit: "#FF7C6C",
          blueKit: "#54B8FF",
          goal: "rgba(231,255,238,0.92)",
        }
      : {
          gradient: ["#D8E9F2", "#A6D5B2", "#548B68"] as const,
          glow: "#FFFFFF",
          beamLeft: ["rgba(255,255,255,0.58)", "rgba(255,255,255,0.18)", "transparent"] as const,
          beamRight: ["rgba(236,249,255,0.55)", "rgba(91,167,255,0.13)", "transparent"] as const,
          line: "rgba(250,255,250,0.92)",
          turf: "rgba(42,142,72,0.4)",
          ball: "#FFFFFF",
          ballMark: "#243329",
          redKit: "#D94F44",
          blueKit: "#176CC2",
          goal: "rgba(255,255,255,0.98)",
        };

  return (
    <View
      accessibilityLabel="Animated football match: blue and red teams race for the ball and shoot at goal"
      accessible
      style={[
        styles.scene,
        { borderColor: mode === "dark" ? "#3D8052" : "#81B991" },
      ]}
    >
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      />
      <View
        pointerEvents="none"
        style={[styles.upperGlow, { backgroundColor: palette.glow }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.lightBeam, styles.leftBeam, leftBeamStyle]}
      >
        <LinearGradient colors={palette.beamLeft} style={styles.beamGradient} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.lightBeam, styles.rightBeam, rightBeamStyle]}
      >
        <LinearGradient colors={palette.beamRight} style={styles.beamGradient} />
      </Animated.View>

      <View pointerEvents="none" style={styles.lightCluster}>
        {Array.from({ length: 5 }, (_, index) => (
          <View key={index} style={styles.lightBulb} />
        ))}
      </View>
      <View pointerEvents="none" style={[styles.lightCluster, styles.rightCluster]}>
        {Array.from({ length: 5 }, (_, index) => (
          <View key={index} style={styles.lightBulb} />
        ))}
      </View>

      <View pointerEvents="none" style={styles.pitch}>
        <Svg width="100%" height="100%" viewBox="0 0 390 150" preserveAspectRatio="none">
          <Polygon points="40,20 350,20 382,145 8,145" fill={palette.turf} />
          <Polyline
            points="40,20 350,20 382,145 8,145 40,20"
            fill="none"
            stroke={palette.line}
            strokeWidth="1.5"
          />
          <Line x1="195" y1="20" x2="195" y2="145" stroke={palette.line} strokeWidth="1.4" />
          <Ellipse cx="195" cy="82.5" rx="38" ry="27" fill="none" stroke={palette.line} strokeWidth="1.5" />
          <Circle cx="195" cy="82.5" r="2.4" fill={palette.line} />
          <Polyline points="116,20 128,37 262,37 274,20" fill="none" stroke={palette.line} strokeWidth="1.2" />
          <Polyline points="128,145 139,128 251,128 262,145" fill="none" stroke={palette.line} strokeWidth="1.2" />
          <Rect x="183" y="17" width="24" height="3" fill={palette.line} />
          <Rect x="183" y="145" width="24" height="3" fill={palette.line} />
          <Polyline points="341,60 376,60 376,101 341,101" fill="none" stroke={palette.goal} strokeWidth="2" />
          <Line x1="341" y1="60" x2="341" y2="101" stroke={palette.goal} strokeWidth="2" />
        </Svg>
      </View>

      {playerPositions.map((position, index) => (
        <MatchPlayer
          key={index}
          beat={gameBeat}
          sceneWidth={sceneWidth}
          position={position}
          index={index}
          jersey={index % 2 === 0 ? palette.redKit : palette.blueKit}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[styles.ball, { backgroundColor: palette.ball }, ballStyle]}
      >
        <View style={[styles.ballMark, { backgroundColor: palette.ballMark }]} />
      </Animated.View>
      <View pointerEvents="none" style={styles.sceneShade} />
    </View>
  );
}

function MatchPlayer({
  beat,
  sceneWidth,
  position,
  index,
  jersey,
}: {
  beat: SharedValue<number>;
  sceneWidth: number;
  position: number;
  index: number;
  jersey: string;
}) {
  const isShooter = index === 2;
  const runDistance = ((50 - position) / 100) * sceneWidth * 0.68;
  const runStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          beat.value,
          [0, 0.08, 0.43, 0.56, 0.64, 0.83, 0.92, 1],
          [
            0,
            0,
            runDistance,
            runDistance,
            runDistance + (isShooter ? 10 : 0),
            0,
            0,
            0,
          ],
        ),
      },
      {
        translateY: interpolate(
          beat.value,
          [0, 0.08, 0.25, 0.43, 0.56, 0.64, 0.83, 0.92, 1],
          [0, 0, -3, 0, -1, isShooter ? -8 : 0, 0, 0, 0],
        ),
      },
      {
        rotate: `${interpolate(
          beat.value,
          [0, 0.08, 0.25, 0.43, 0.56, 0.64, 0.83, 0.92, 1],
          [0, 0, index % 2 ? -7 : 7, 0, 0, isShooter ? -20 : 0, 0, 0, 0],
        )}deg`,
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.player, { left: `${position}%` }, runStyle]}
    >
      <View style={styles.playerFigure}>
        <View style={styles.playerHead} />
        <View style={[styles.playerTorso, { backgroundColor: jersey }]} />
        <View style={[styles.playerArm, styles.playerArmLeft, { backgroundColor: jersey }]} />
        <View style={[styles.playerArm, styles.playerArmRight, { backgroundColor: jersey }]} />
        <View style={[styles.playerLeg, styles.playerLegLeft]} />
        <View style={[styles.playerLeg, styles.playerLegRight]} />
      </View>
    </Animated.View>
  );
}

const styles = createThemedStyles({
  scene: {
    height: 178,
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: "#10251A",
    borderWidth: 1,
    borderColor: "#3D8052",
    position: "relative",
  },
  gradient: StyleSheet.absoluteFill,
  upperGlow: {
    position: "absolute",
    top: -72,
    left: "25%",
    width: 190,
    height: 150,
    borderRadius: 100,
    backgroundColor: "#DFFFE8",
    opacity: 0.09,
  },
  lightBeam: {
    position: "absolute",
    top: -76,
    width: 130,
    height: 205,
    borderRadius: 70,
  },
  leftBeam: { left: 16 },
  rightBeam: { right: 16 },
  beamGradient: { flex: 1, borderRadius: 70 },
  lightCluster: {
    position: "absolute",
    top: 12,
    left: 15,
    flexDirection: "row",
    gap: 4,
    padding: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(5,13,13,0.56)",
    zIndex: 2,
  },
  rightCluster: { left: undefined, right: 15 },
  lightBulb: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E8FFE9",
    shadowColor: "#B9FFC9",
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  pitch: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 105,
    zIndex: 2,
  },
  player: {
    position: "absolute",
    width: 16,
    height: 31,
    marginLeft: -8,
    bottom: 20,
    zIndex: 3,
  },
  playerFigure: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
  },
  playerHead: {
    position: "absolute",
    top: 0,
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "#F1C8A6",
  },
  playerTorso: {
    position: "absolute",
    top: 7,
    width: 10,
    height: 11,
    borderRadius: 3,
    borderWidth: 0.7,
    borderColor: "rgba(255,255,255,0.8)",
  },
  playerArm: {
    position: "absolute",
    top: 8,
    width: 3,
    height: 11,
    borderRadius: radii.pill,
  },
  playerArmLeft: { left: 1, transform: [{ rotate: "18deg" }] },
  playerArmRight: { right: 1, transform: [{ rotate: "-18deg" }] },
  playerLeg: {
    position: "absolute",
    top: 18,
    width: 4,
    height: 11,
    borderRadius: radii.pill,
    backgroundColor: "#18231D",
  },
  playerLegLeft: { left: 4, transform: [{ rotate: "8deg" }] },
  playerLegRight: { right: 4, transform: [{ rotate: "-8deg" }] },
  ball: {
    position: "absolute",
    left: "46%",
    bottom: 17,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F8F3",
    borderWidth: 1,
    borderColor: "#111A15",
    zIndex: 4,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.75,
    shadowRadius: 6,
  },
  ballMark: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#17211A",
  },
  sceneShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3,9,9,0.08)",
    zIndex: 5,
  },
});
