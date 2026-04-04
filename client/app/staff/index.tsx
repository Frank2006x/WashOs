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
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function StaffHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

  const phaseCards = useMemo(
    () => [
      { key: "intake", label: "Intake Scan", icon: "inbox-arrow-down", desc: "Collect bag, start journey", color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10 dark:bg-blue-500/20" },
      { key: "wash_start", label: "Wash Start", icon: "washing-machine", desc: "Assign a washer", color: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-500/10 dark:bg-indigo-500/20" },
      { key: "wash_finish", label: "Wash Finish", icon: "washing-machine-off", desc: "Complete wash cycle", color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10 dark:bg-purple-500/20" },
      { key: "dry_start", label: "Dry Start", icon: "tumble-dryer", desc: "Assign a dryer", color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/10 dark:bg-orange-500/20" },
      { key: "dry_finish", label: "Dry Finish", icon: "tumble-dryer-off", desc: "Complete dry cycle", color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 dark:bg-amber-500/20" },
      { key: "ready", label: "Ready Scan", icon: "check-circle-outline", desc: "Assign pickup row", color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-500/20" },
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
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className={`${isCompact ? "text-2xl" : "text-3xl"} font-extrabold text-card-foreground dark:text-card-foreground-dark`}
              >
                {t("staff.home_title", "Laundry Staff")}
              </Text>
              <Text
                className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark pr-4`}
              >
                {t("staff.home_desc", "Select a workflow action below to jump straight to the Scan Center.")}
              </Text>
            </View>
            <View className="bg-primary/10 dark:bg-primary-dark/20 h-16 w-16 rounded-full items-center justify-center border border-primary/20 dark:border-primary-dark/20">
              <MaterialCommunityIcons name="shield-account-outline" size={32} color="#4194d7" />
            </View>
          </View>
          
          <Pressable
            className="mt-6 flex-row items-center justify-center gap-2 rounded-full bg-primary-dark px-4 py-3.5 dark:bg-primary"
            onPress={() => router.push("/staff/scan")}
          >
            <MaterialCommunityIcons name="barcode-scan" size={20} color="white" />
            <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
              Open Scan Center
            </Text>
          </Pressable>
        </View>

        <Text className="mt-8 mb-4 ml-2 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Workflow Phases
        </Text>
        
        <View className="gap-3">
          {phaseCards.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => router.push({ pathname: "/staff/scan", params: { phase: item.key } })}
              className={`flex-row items-center rounded-3xl border border-border bg-card dark:border-border-dark dark:bg-card-dark ${isCompact ? "p-3" : "p-4"}`}
            >
              <View className={`${item.bg} h-12 w-12 items-center justify-center rounded-2xl`}>
                <MaterialCommunityIcons name={item.icon as any} size={24} className={item.color} />
              </View>
              <View className="ml-4 flex-1">
                <Text
                  className={`${isCompact ? "text-sm" : "text-base"} font-bold text-card-foreground dark:text-card-foreground-dark`}
                >
                  {item.label}
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {item.desc}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#a1a1aa" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
