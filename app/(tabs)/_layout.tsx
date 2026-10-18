import { Tabs, usePathname } from "expo-router";
import { Bell, House, Shield, Trophy, UserRound } from "lucide-react-native";

import { useAuth } from "@/src/lib/auth";
import { getClubTabHref, getHomeTabHref } from "@/src/lib/clubTabs";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors } from "@/src/theme/tokens";

export default function TabLayout() {
  useThemeRefresh();
  const { club } = useAuth();
  const pathname = usePathname();
  const isAuthScreen = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          display: isAuthScreen ? "none" : "flex",
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          href: getHomeTabHref(club),
          tabBarIcon: ({ color }) => <House color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: "Tournaments",
          href: getClubTabHref(club),
          tabBarIcon: ({ color }) => <Trophy color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: "Teams",
          href: getClubTabHref(club),
          tabBarIcon: ({ color }) => <Shield color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Updates",
          href: getClubTabHref(club),
          tabBarIcon: ({ color }) => <Bell color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <UserRound color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}
