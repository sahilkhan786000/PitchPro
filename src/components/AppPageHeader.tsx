import { router } from "expo-router";
import { House, MoonStar, SunMedium, Trophy } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/lib/auth";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

export function AppPageHeader({
  showBrand = true,
  centered = false,
}: {
  showBrand?: boolean;
  centered?: boolean;
}) {
  const { club, clearClub } = useAuth();
  const { mode, toggleTheme } = useAppTheme();

  const handleClearClub = async () => {
    await clearClub();
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.header, centered && styles.centeredHeader]}>
      <View style={styles.headerLeft}>
        {club ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave Club"
            onPress={handleClearClub}
            style={styles.iconButton}
          >
            <House color={colors.text} size={18} />
          </Pressable>
        ) : null}
        {showBrand && !centered ? (
          <BrandLockup name={club?.name ?? "PitchPRO"} />
        ) : null}
      </View>
      {showBrand && centered ? (
        <BrandLockup
          name={club?.name ?? "PitchPRO"}
          centered
        />
      ) : null}
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          onPress={toggleTheme}
          style={styles.iconButton}
        >
          {mode === "dark" ? (
            <SunMedium color={colors.text} size={18} />
          ) : (
            <MoonStar color={colors.text} size={18} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function BrandLockup({
  name,
  centered = false,
}: {
  name: string;
  centered?: boolean;
}) {
  return (
    <View style={[styles.brandLockup, centered && styles.centeredBrandLockup]}>
      <View style={styles.brandMark}>
        <Trophy color={colors.background} size={15} strokeWidth={2.7} />
      </View>
      <Text
        numberOfLines={1}
        style={[styles.brand, centered && styles.centeredBrand]}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = createThemedStyles({
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    zIndex: 1,
    elevation: 1,
  },
  centeredHeader: { justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  centeredBrandLockup: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    zIndex: 1,
    elevation: 1,
    transform: [{ translateY: 102 }],
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  centeredBrand: { color: "#FFFFFF", fontSize: 18 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
