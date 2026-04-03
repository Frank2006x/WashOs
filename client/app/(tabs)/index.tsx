import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function HomeTab() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        {t("home.welcome", "Welcome to Wash Os")}
      </Text>
      <Text className="mt-3 text-base text-muted-foreground dark:text-muted-foreground-dark">
        {t("home.description", "Quick actions, order tracking, and schedules all in one place.")}
      </Text>
    </View>
  );
}
