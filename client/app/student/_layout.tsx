import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, Tabs } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { studentService } from "@/services/api";

export default function StudentTabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role !== "student") return;
    (async () => {
      try {
        const res = await studentService.listUnreadNotifications(50, 0);
        setUnreadCount((res.notifications || []).length);
      } catch {
        setUnreadCount(0);
      }
    })();
  }, [user?.role]);

  if (loading) {
    return null;
  }

  if (user?.role !== "student") {
    return <Redirect href="/staff" />;
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
            <MaterialIcons name="home-filled" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Laundry",
          href: null,
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
        name="profile"
        options={{
          title: t("tabs.profile") as string,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="queries"
        options={{
          title: "Queries",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="support-agent" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
