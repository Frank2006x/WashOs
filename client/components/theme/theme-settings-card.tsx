import { Text, TouchableOpacity, View } from "react-native";

type ThemeMode = "light" | "dark" | "system";

type ThemeSettingsCardProps = {
  selectedMode: ThemeMode;
  resolvedScheme: "light" | "dark";
  onSelectMode: (mode: ThemeMode) => void;
};

function ThemeOptionButton({
  label,
  isActive,
  onPress,
}: {
  label: ThemeMode;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`rounded-xl border px-4 py-3 ${
        isActive
          ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
          : "border-border bg-muted dark:border-border-dark dark:bg-muted-dark"
      }`}
    >
      <Text
        className={`text-lg font-semibold capitalize ${
          isActive
            ? "text-primary-foreground dark:text-primary-foreground-dark"
            : "text-foreground dark:text-foreground-dark"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ThemeSettingsCard({
  selectedMode,
  resolvedScheme,
  onSelectMode,
}: ThemeSettingsCardProps) {
  return (
    <View className="rounded-3xl border border-border bg-card p-6 dark:border-border-dark dark:bg-card-dark">
      <Text className="text-3xl font-bold text-card-foreground dark:text-card-foreground-dark">
        Theme Settings
      </Text>
      <Text className="mt-2 text-base text-muted-foreground dark:text-muted-foreground-dark">
        Follow system appearance by default, or choose a mode manually.
      </Text>

      <View className="mt-6 gap-3">
        <ThemeOptionButton
          label="system"
          isActive={selectedMode === "system"}
          onPress={() => onSelectMode("system")}
        />
        <ThemeOptionButton
          label="light"
          isActive={selectedMode === "light"}
          onPress={() => onSelectMode("light")}
        />
        <ThemeOptionButton
          label="dark"
          isActive={selectedMode === "dark"}
          onPress={() => onSelectMode("dark")}
        />
      </View>

      <Text className="mt-6 text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Active mode: {selectedMode}
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Resolved scheme: {resolvedScheme}
      </Text>
    </View>
  );
}
