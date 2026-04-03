import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import "../global.css";
import "../i18n";

function RootLayoutNav() {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until auth state is resolved from storage
    if (loading) return;

    const topSegment = segments[0];
    const inLogin = topSegment === "login";
    const inSharedBooking = topSegment === "booking";
    const inStudentGroup = topSegment === "student";
    const inStaffGroup = topSegment === "staff";
    const inLegacyTabsGroup = topSegment === "(tabs)";

    if (!isAuthenticated && !inLogin) {
      router.replace("/login");
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    const isStudent = user?.role === "student";
    const isStaff = user?.role === "laundry_staff";

    if (isStudent && !inStudentGroup) {
      if (inSharedBooking) return;
      router.replace("/student");
      return;
    }

    if (isStaff && !inStaffGroup) {
      if (inSharedBooking) return;
      router.replace("/staff");
      return;
    }

    // Fallback for unexpected legacy group visits.
    if (inLegacyTabsGroup) {
      router.replace(isStudent ? "/student" : "/staff");
    }
  }, [isAuthenticated, loading, segments, router, user]);

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
