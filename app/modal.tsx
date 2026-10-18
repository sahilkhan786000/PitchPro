import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

import EditScreenInfo from "@/components/EditScreenInfo";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles } from "@/src/theme/tokens";

export default function ModalScreen() {
  const { mode } = useAppTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal</Text>
      <View style={styles.separator} />
      <EditScreenInfo path="app/modal.tsx" />

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
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
