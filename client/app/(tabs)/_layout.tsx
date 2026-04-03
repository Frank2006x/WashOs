import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "#1f1e1d" : "#faf9f5",
          borderTopColor: isDark ? "#3e3e38" : "#dad9d4",
        },
        tabBarActiveTintColor: isDark ? "#4194d7" : "#4194d7",
        tabBarInactiveTintColor: isDark ? "#b7b5a9" : "#83827d",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home-filled" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Laundry",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="local-laundry-service"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          href: isStudent ? null : "/(tabs)/scan",
          title: t("tabs.scan") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="qr-code-scanner" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
