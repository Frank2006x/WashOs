import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileTab() {
  const { user, profile, logout, loading } = useAuth();

  const handleLogout = async () => {
    await logout();
    // Root layout redirect handles moving unauthenticated users to login.
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "student":
        return "Student";
      case "laundry_staff":
        return "Laundry Staff";
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "student":
        return "school";
      case "laundry_staff":
        return "local-laundry-service";
      default:
        return "person";
    }
  };

  const profileName = profile?.name || "User";
  const profilePhone =
    user?.role === "laundry_staff" ? (profile as any)?.phone : null;
  const profileRegNo =
    user?.role === "student" ? (profile as any)?.reg_no : null;

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 py-8">
        <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
          Profile
        </Text>
        <Text className="mt-2 text-base text-muted-foreground dark:text-muted-foreground-dark">
          Your account information
        </Text>

        {/* Profile Card */}
        <View className="mt-8 rounded-2xl bg-card p-6 dark:bg-card-dark">
          <View className="mb-6 flex-row items-center">
            <View className="mr-4 h-16 w-16 items-center justify-center rounded-full bg-primary-dark/10 dark:bg-primary/10">
              <MaterialIcons
                name={getRoleIcon(user?.role || "person") as any}
                size={32}
                color="#293975"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-card-foreground dark:text-card-foreground-dark">
                {profileName}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                {getRoleLabel(user?.role || "")}
              </Text>
            </View>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground-dark">
                Email
              </Text>
              <Text className="text-base font-medium text-card-foreground dark:text-card-foreground-dark">
                {user?.email}
              </Text>
            </View>

            {profilePhone && (
              <View className="mt-4">
                <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground-dark">
                  Phone
                </Text>
                <Text className="text-base font-medium text-card-foreground dark:text-card-foreground-dark">
                  {profilePhone}
                </Text>
              </View>
            )}

            {profileRegNo && (
              <View className="mt-4">
                <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground-dark">
                  Reg No
                </Text>
                <Text className="text-base font-medium text-card-foreground dark:text-card-foreground-dark">
                  {profileRegNo}
                </Text>
              </View>
            )}

            <View className="mt-4">
              <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground-dark">
                User ID
              </Text>
              <Text className="text-base font-mono text-card-foreground dark:text-card-foreground-dark">
                {user?.id.substring(0, 8)}...
              </Text>
            </View>

            <View className="mt-4">
              <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground-dark">
                Member Since
              </Text>
              <Text className="text-base font-medium text-card-foreground dark:text-card-foreground-dark">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          onPress={handleLogout}
          className="mt-8 items-center rounded-full bg-destructive py-4 active:opacity-85 dark:bg-destructive-dark"
        >
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="logout" size={20} color="#f9f5ee" />
            <Text className="font-bold text-destructive-foreground dark:text-destructive-foreground-dark">
              Log Out
            </Text>
          </View>
        </Pressable>

        <View className="mt-6 rounded-xl bg-card/50 p-4 dark:bg-card-dark/50">
          <Text className="text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
            WashOs v1.0.0
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
