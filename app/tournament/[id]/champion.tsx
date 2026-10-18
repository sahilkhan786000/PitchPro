import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  ArrowLeft,
  Check,
  Crown,
  Medal,
  RotateCcw,
  Share2,
  Trophy,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef, type ViewShotRef } from "react-native-view-shot";

import { TeamCrest } from "@/src/components/TeamCrest";
import { resolveFinalWinner } from "@/src/features/finals/rules";
import { getTournament } from "@/src/features/tournaments/api";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

const { width: screenWidth } = Dimensions.get("window");

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export default function ChampionScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ id: string }>();
  const tournamentId = typeof params.id === "string" ? params.id : "";
  const query = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId),
    enabled: Boolean(tournamentId),
  });
  const reveal = useSharedValue(0);
  const confetti = useRef<InstanceType<typeof ConfettiCannon> | null>(null);
  const posterRef = useRef<ViewShotRef>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReducedMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const finalFixture = query.data?.fixtures.find(
    (fixture) => fixture.stage === "final",
  );
  const winnerId = resolveFinalWinner(finalFixture);
  const winner = query.data?.teams.find((team) => team.id === winnerId);
  const opponent = query.data?.teams.find(
    (team) =>
      team.id ===
      (winnerId === finalFixture?.home_team_id
        ? finalFixture?.away_team_id
        : finalFixture?.home_team_id),
  );
  const finalScore = finalFixture
    ? `${finalFixture.home_score} - ${finalFixture.away_score}`
    : "";
  const celebrationDate = finalFixture?.played_at
    ? new Date(finalFixture.played_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  useEffect(() => {
    if (!winnerId) return;
    if (reducedMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = withSpring(1, { damping: 16, stiffness: 92, mass: 0.9 });
    const timer = setTimeout(() => confetti.current?.start(), 500);
    return () => {
      clearTimeout(timer);
      cancelAnimation(reveal);
      confetti.current?.stop();
    };
  }, [reducedMotion, reveal, winnerId]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: interpolate(reveal.value, [0, 1], [28, 0]) },
      { scale: interpolate(reveal.value, [0, 1], [0.72, 1]) },
    ],
  }));

  const replay = () => {
    setSkipped(false);
    if (reducedMotion) return;
    reveal.value = 0;
    reveal.value = withSpring(1, { damping: 16, stiffness: 92, mass: 0.9 });
    confetti.current?.start();
  };
  const skip = () => {
    reveal.value = 1;
    setSkipped(true);
    confetti.current?.stop();
  };
  const share = async () => {
    if (!posterRef.current) return;
    setIsSharing(true);
    setShareStatus("");
    try {
      const imageUri = await captureRef(posterRef.current, {
        format: "png",
        quality: 1,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
      });

      if (Platform.OS === "web") {
        if (
          typeof navigator !== "undefined" &&
          navigator.share &&
          navigator.canShare &&
          typeof File !== "undefined"
        ) {
          try {
            const blob = await fetch(imageUri).then((response) =>
              response.blob(),
            );
            const imageFile = new File([blob], "pitchpro-champions.png", {
              type: "image/png",
            });
            if (navigator.canShare({ files: [imageFile] })) {
              await navigator.share({
                files: [imageFile],
                title: "PitchPRO Champions",
              });
              setShareStatus("Champion image shared.");
              return;
            }
          } catch (error) {
            if (isAbortError(error)) return;
          }
        }
        if (typeof document === "undefined")
          throw new Error("Image sharing is unavailable.");
        const downloadLink = document.createElement("a");
        downloadLink.href = imageUri;
        downloadLink.download = "pitchpro-champions.png";
        downloadLink.click();
        setShareStatus("Champion image downloaded.");
        return;
      }

      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Image sharing is unavailable on this device.");
      const localUri = /^(file|content):\/\//.test(imageUri)
        ? imageUri
        : `file://${imageUri}`;
      await Sharing.shareAsync(localUri, {
        dialogTitle: "Share champion image",
        mimeType: "image/png",
      });
      setShareStatus("Champion image shared.");
    } catch (error) {
      if (isAbortError(error)) return;
      setShareStatus("Could not create or share champion image.");
    } finally {
      setIsSharing(false);
    }
  };

  if (query.isLoading)
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <Text style={styles.muted}>Finding the champion…</Text>
      </SafeAreaView>
    );
  if (query.isError || !query.data || !finalFixture)
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <Text style={styles.muted}>The final result is unavailable.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Back to tournament</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (!winner || !opponent)
    return (
      <SafeAreaView style={styles.center} edges={["left", "right", "bottom"]}>
        <View style={styles.drawIcon}>
          <Crown color={colors.gold} size={23} />
        </View>
        <Pressable
          onPress={() =>
            router.replace({
              pathname: "/tournament/[id]",
              params: { id: tournamentId },
            })
          }
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>View final result</Text>
        </Pressable>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to tournament"
          onPress={() =>
            router.replace({
              pathname: "/tournament/[id]",
              params: { id: tournamentId },
            })
          }
          style={styles.iconButton}
        >
          <ArrowLeft color={colors.text} size={18} />
        </Pressable>
        <Text style={styles.topTitle}>CHAMPIONSHIP NIGHT</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Replay celebration"
          onPress={replay}
          style={styles.iconButton}
        >
          <RotateCcw color={colors.text} size={17} />
        </Pressable>
      </View>
      {!reducedMotion && !skipped ? (
        <ConfettiCannon
          ref={confetti}
          count={90}
          origin={{ x: screenWidth / 2, y: 0 }}
          autoStart={false}
          fadeOut
          explosionSpeed={330}
          fallSpeed={3100}
          colors={[
            colors.gold,
            colors.accent,
            "#F7F8FA",
            colors.blue,
            "#E88939",
          ]}
        />
      ) : null}
      <View style={styles.stage}>
        <View ref={posterRef} collapsable={false} style={styles.posterCapture}>
          <View pointerEvents="none" style={styles.stadiumGlow} />
          <View pointerEvents="none" style={styles.lightRow}>
            <View style={styles.lightBeam} />
            <View style={styles.lightBeam} />
          </View>
          <Animated.View style={[styles.trophyWrap, revealStyle]}>
            <View style={styles.trophyHalo}>
              <Trophy color={colors.gold} size={76} strokeWidth={1.25} />
            </View>
          </Animated.View>
          <Animated.View style={[styles.copy, revealStyle]}>
            <Text style={styles.kicker}>THE SEASON IS SETTLED</Text>
            <Text style={styles.champions}>CHAMPIONS</Text>
            <View style={styles.winnerRow}>
              <TeamCrest
                name={winner.name}
                logoPath={winner.logo_path}
                size={42}
                style={styles.crest}
              />
              <Text style={styles.winnerName}>{winner.name}</Text>
            </View>
            <View style={styles.scoreCard}>
              <View style={styles.finalLabel}>
                <Medal color={colors.gold} size={14} />
                <Text style={styles.finalText}>FINAL SCORE</Text>
              </View>
              <Text style={styles.score}>{finalScore}</Text>
              <Text style={styles.opponent}>vs {opponent.name}</Text>
            </View>
            <View style={styles.tournamentLine}>
              <Trophy color={colors.muted} size={14} />
              <Text style={styles.tournamentName}>
                {query.data.tournament.name}
              </Text>
            </View>
            {celebrationDate ? (
              <Text style={styles.date}>{celebrationDate}</Text>
            ) : null}
          </Animated.View>
        </View>
        {!skipped ? (
          <Pressable
            accessibilityRole="button"
            onPress={skip}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip reveal</Text>
          </Pressable>
        ) : null}
        {shareStatus ? (
          <Text accessibilityLiveRegion="polite" style={styles.shareStatus}>
            {shareStatus}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: "/tournament/[id]",
                params: { id: tournamentId },
              })
            }
            style={styles.secondaryAction}
          >
            <Check color={colors.text} size={16} />
            <Text style={styles.secondaryText}>Tournament</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSharing}
            onPress={() => void share()}
            style={[styles.shareAction, isSharing && styles.shareDisabled]}
          >
            <Share2 color={colors.background} size={16} />
            <Text style={styles.shareText}>
              {isSharing ? "Preparing image..." : "Share champion"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: "#0B0E11" },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: 12,
  },
  muted: { color: colors.muted, fontSize: 13, textAlign: "center" },
  link: { color: colors.accent, fontWeight: "800", padding: spacing.md },
  topbar: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    zIndex: 3,
  },
  topTitle: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: "#171B20",
    borderWidth: 1,
    borderColor: "#303741",
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  posterCapture: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#0B0E11",
  },
  stadiumGlow: {
    position: "absolute",
    top: -180,
    width: 500,
    height: 400,
    borderRadius: 250,
    backgroundColor: "#253328",
    opacity: 0.45,
  },
  lightRow: {
    position: "absolute",
    top: 15,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    opacity: 0.75,
  },
  lightBeam: {
    width: 70,
    height: 3,
    borderRadius: 4,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 8,
  },
  trophyWrap: { alignItems: "center", marginBottom: spacing.md },
  trophyHalo: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#29261D",
    borderWidth: 1,
    borderColor: "#61532E",
    shadowColor: colors.gold,
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  copy: { width: "100%", maxWidth: 450, alignItems: "center" },
  kicker: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginTop: spacing.md,
  },
  champions: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  winnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    marginTop: spacing.lg,
    maxWidth: "100%",
  },
  crest: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#23382C",
    borderWidth: 1,
    borderColor: "#497256",
  },
  crestInitial: { color: colors.accent, fontSize: 18, fontWeight: "900" },
  winnerName: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "900",
    flexShrink: 1,
    textAlign: "center",
  },
  scoreCard: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    backgroundColor: "#171B20",
    borderWidth: 1,
    borderColor: "#3D4147",
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  finalLabel: { flexDirection: "row", alignItems: "center", gap: 7 },
  finalText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  score: {
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 28,
    marginTop: spacing.sm,
  },
  opponent: { color: colors.muted, fontSize: 11, marginTop: 3 },
  tournamentLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: spacing.lg,
    maxWidth: "100%",
  },
  tournamentName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "center",
  },
  date: { color: colors.dim, fontSize: 10, marginTop: 6 },
  skip: { position: "absolute", right: spacing.lg, top: 5, padding: 8 },
  skipText: { color: colors.dim, fontSize: 10, fontWeight: "700" },
  shareStatus: {
    color: colors.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: spacing.md,
  },
  actions: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    gap: 9,
    marginTop: spacing.xl,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 47,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#3D4147",
    backgroundColor: "#171B20",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  shareAction: {
    flex: 1.3,
    minHeight: 47,
    borderRadius: radii.sm,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareDisabled: { opacity: 0.65 },
  shareText: { color: colors.background, fontSize: 11, fontWeight: "900" },
  drawIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#302B1F",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  linkButton: {
    minHeight: 45,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  linkButtonText: { color: colors.background, fontSize: 12, fontWeight: "900" },
});
