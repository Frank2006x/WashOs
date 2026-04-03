import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import "../global.css";

function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until auth state is resolved from storage
    if (loading) return;

    const inTabsGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && inTabsGroup) {
      // Logged out while inside the app → go to login
      router.replace("/login");
    } else if (isAuthenticated && !inTabsGroup) {
      // Logged in but on login screen → go to app
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading, segments, router]);

  // CRITICAL: <Slot /> must ALWAYS be rendered.
  // Without it the navigator doesn't exist and router.replace() silently fails,
  // leaving the screen frozen. The redirect fires through the Slot.
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
