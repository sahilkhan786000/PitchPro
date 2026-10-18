import { Text, View } from "react-native";

import EditScreenInfo from "@/components/EditScreenInfo";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles } from "@/src/theme/tokens";

export default function TabTwoScreen() {
  useThemeRefresh();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab Two</Text>
      <View style={styles.separator} />
      <EditScreenInfo path="app/(tabs)/two.tsx" />
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    backgroundColor: colors.border,
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
