import { useQuery } from "@tanstack/react-query";
import { Image, Text, View, type ViewStyle } from "react-native";

import { getSignedLogoUrl } from "../features/tournaments/api";
import { useThemeRefresh } from "../theme/ThemeContext";
import { colors, createThemedStyles } from "../theme/tokens";

export function TeamCrest({
  name,
  logoPath,
  size = 28,
  style,
}: {
  name: string;
  logoPath?: string | null;
  size?: number;
  style?: ViewStyle;
}) {
  useThemeRefresh();
  const logo = useQuery({
    queryKey: ["team-logo", logoPath],
    queryFn: () => getSignedLogoUrl("team-logos", logoPath!),
    enabled: Boolean(logoPath),
    staleTime: 45 * 60 * 1000,
    retry: 1,
  });

  return (
    <View
      accessibilityLabel={`${name} crest`}
      style={[
        styles.crest,
        { width: size, height: size, borderRadius: size * 0.28 },
        style,
      ]}
    >
      {logo.data ? (
        <Image
          source={{ uri: logo.data }}
          resizeMode="contain"
          style={styles.image}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.max(10, size * 0.4) }]}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = createThemedStyles({
  crest: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  initial: { color: colors.accent, fontWeight: "900" },
});
