import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

export default function StaffTabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user?.role !== "laundry_staff") {
    return <Redirect href="/student" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "#1f1e1d" : "#faf9f5",
          borderTopColor: isDark ? "#3e3e38" : "#dad9d4",
        },
        tabBarActiveTintColor: "#4194d7",
        tabBarInactiveTintColor: isDark ? "#b7b5a9" : "#83827d",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("tabs.scan") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="barcode-scan"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="queries"
        options={{
          title: "Queries",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="message-reply-text"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
