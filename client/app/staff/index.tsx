import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StaffHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

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
    <SafeAreaView
      className="flex-1 bg-background dark:bg-background-dark"
      edges={["top"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName={
          isCompact ? "px-4 py-4 pb-16" : "px-6 py-6 pb-20"
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          className={`rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-5" : "p-6"}`}
        >
          <Text
            className={`${isCompact ? "text-2xl" : "text-3xl"} font-extrabold text-card-foreground dark:text-card-foreground-dark`}
          >
            {t("staff.home_title", "Laundry Staff")}
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            {t("staff.home_desc", "Scan Center is the only workflow screen.")}
          </Text>
          <Pressable
            className="mt-5 items-center rounded-full bg-primary-dark px-4 py-3 dark:bg-primary"
            onPress={() => router.push("/staff/scan")}
          >
            <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
              Open Scan Center
            </Text>
          </Pressable>
        </View>

        <View
          className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Workflow
          </Text>
          <View className="mt-4 gap-3">
            {flowItems.map((line) => (
              <View
                key={line}
                className={`rounded-2xl border border-border bg-background dark:border-border-dark dark:bg-background-dark ${isCompact ? "px-3 py-2.5" : "px-4 py-3"}`}
              >
                <Text
                  className={`${isCompact ? "text-xs leading-5" : "text-sm leading-6"} font-semibold text-card-foreground dark:text-card-foreground-dark`}
                >
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text
          className={`mt-5 text-center ${isCompact ? "text-[11px]" : "text-xs"} text-muted-foreground dark:text-muted-foreground-dark`}
        >
          Keep this screen simple. All actions happen in Scan Center.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
