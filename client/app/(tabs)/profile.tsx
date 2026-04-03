import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function ProfileTab() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        Profile
      </Text>
      <Text className="mt-3 text-base text-muted-foreground dark:text-muted-foreground-dark">
        Demo account. Tap below to return to login.
      </Text>

      <Pressable
        onPress={() => router.replace("/")}
        className="mt-8 items-center rounded-full bg-primary-dark py-3 dark:bg-primary"
      >
        <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
          Log Out
        </Text>
      </Pressable>
    </View>
  );
}
