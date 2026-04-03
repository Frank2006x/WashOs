import { Text, View } from "react-native";

export default function HomeTab() {
  return (
    <View className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        Welcome to Wash Os
      </Text>
      <Text className="mt-3 text-base text-muted-foreground dark:text-muted-foreground-dark">
        Quick actions, order tracking, and schedules all in one place.
      </Text>
    </View>
  );
}
