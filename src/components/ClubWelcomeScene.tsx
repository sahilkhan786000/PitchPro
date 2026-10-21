import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "@/src/theme/ThemeContext";
import { radii, spacing } from "@/src/theme/tokens";

const slides = [
  require("../../assets/images/Football (1).jpg"),
  require("../../assets/images/Football (2).jpg"),
  require("../../assets/images/Football (3).jpg"),
  require("../../assets/images/Football (4).jpg"),
  require("../../assets/images/Football (5).jpg"),
];
const slideDuration = 3000;
const transitionDuration = 850;

export function ClubWelcomeScene() {
  const { mode } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const indexRef = useRef(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [sceneWidth, setSceneWidth] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % slides.length;
      setIncomingIndex(nextIndex);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: transitionDuration,
        easing: Easing.inOut(Easing.cubic),
      });
      transitionTimer.current = setTimeout(() => {
        indexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        setIncomingIndex(null);
        progress.value = 0;
        transitionTimer.current = null;
      }, transitionDuration);
    }, slideDuration);

    return () => {
      clearInterval(interval);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      cancelAnimation(progress);
    };
  }, [progress]);

  const currentStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? interpolate(progress.value, [0, 1], [1, 0]) : 1,
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(progress.value, [0, 1], [0, -sceneWidth]),
      },
    ],
  }));
  const incomingStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? progress.value : 1,
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(progress.value, [0, 1], [sceneWidth, 0]),
      },
    ],
  }));
  const frameColor = mode === "dark" ? "#426B55" : "#87A891";

  return (
    <View
      accessible
      accessibilityLabel="Football photo carousel, changing every three seconds"
      onLayout={(event) => setSceneWidth(event.nativeEvent.layout.width)}
      style={[styles.scene, { borderColor: frameColor }]}
    >
      <Animated.Image
        accessibilityIgnoresInvertColors
        source={slides[currentIndex]}
        resizeMode="cover"
        style={[styles.image, currentStyle]}
      />
      {incomingIndex !== null ? (
        <Animated.Image
          accessibilityIgnoresInvertColors
          source={slides[incomingIndex]}
          resizeMode="cover"
          style={[styles.image, incomingStyle]}
        />
      ) : null}
      <View pointerEvents="none" style={styles.shade} />
      <View pointerEvents="none" style={styles.indicators}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              { backgroundColor: mode === "dark" ? "#FFFFFF" : "#17251B" },
              index === currentIndex && styles.activeIndicator,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    height: 190,
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#0A1A13",
    position: "relative",
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3,9,9,0.12)",
  },
  indicators: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  indicator: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    opacity: 0.58,
  },
  activeIndicator: {
    width: 16,
    opacity: 1,
  },
});
