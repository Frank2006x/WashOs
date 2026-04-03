import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function OrdersTab() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        {t("orders.title", "Orders")}
      </Text>
      <Text className="mt-3 text-base text-muted-foreground dark:text-muted-foreground-dark">
        {t("orders.no_orders", "No active orders yet. New wash requests will appear here.")}
      </Text>
    </View>
  );
}
