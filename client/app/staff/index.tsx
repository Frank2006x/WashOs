import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

export default function StaffHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const flowItems = useMemo(
    () => [
      "1. Intake scan",
      "2. Wash start (select washer + scan)",
      "3. Wash finish (select washer + scan)",
      "4. Dry start (select dryer + scan)",
      "5. Dry finish (select dryer + scan)",
      "6. Ready scan (enter row + scan)",
    ],
    [],
  );

  return (
    <ScrollView className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        {t("staff.home_title", "Laundry Staff")}
      </Text>
      <Text className="mt-3 text-base text-muted-foreground dark:text-muted-foreground-dark">
        {t("staff.home_desc", "Scan Center is the only workflow screen.")}
      </Text>

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Workflow
        </Text>
        <View className="mt-3 gap-3">
          {flowItems.map((line) => (
            <View
              key={line}
              className="rounded-xl border border-border px-4 py-3 dark:border-border-dark"
            >
              <Text className="text-sm font-semibold text-card-foreground dark:text-card-foreground-dark">
                {line}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        className="mt-6 items-center rounded-full bg-primary-dark py-3 dark:bg-primary"
        onPress={() => router.push("/staff/scan")}
      >
        <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
          Open Scan Center
        </Text>
      </Pressable>
    </ScrollView>
  );
}
