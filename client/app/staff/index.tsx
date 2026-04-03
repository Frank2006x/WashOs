import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { BookingRecord, staffService } from "@/services/api";

export default function StaffHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<BookingRecord[]>([]);
  const [ready, setReady] = useState<BookingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadQueues = useCallback(async () => {
    try {
      setError(null);
      const [processingRes, readyRes] = await Promise.all([
        staffService.listProcessingBookings(),
        staffService.listReadyBookings(),
      ]);
      setProcessing(processingRes.bookings || []);
      setReady(readyRes.bookings || []);
    } catch (e: any) {
      setError(
        e?.response?.data?.error || e?.message || "Failed to load queues",
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadQueues();
      setLoading(false);
    })();
  }, [loadQueues]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQueues();
    setRefreshing(false);
  }, [loadQueues]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background px-6 py-8 dark:bg-background-dark"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        {t("staff.home_title", "Laundry Staff")}
      </Text>
      <Text className="mt-3 text-base text-muted-foreground dark:text-muted-foreground-dark">
        {t(
          "staff.home_desc",
          "Use the Scan tab to receive student bags and monitor queues.",
        )}
      </Text>

      {error ? (
        <View className="mt-6 rounded-2xl bg-destructive/10 p-4 dark:bg-destructive-dark/20">
          <Text className="font-medium text-destructive dark:text-destructive-dark">
            {error}
          </Text>
          <Pressable
            className="mt-3 self-start rounded-full bg-primary-dark px-4 py-2 dark:bg-primary"
            onPress={loadQueues}
          >
            <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
              {t("common.retry", "Retry")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mt-6 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-card p-4 dark:bg-card-dark">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            {t("staff.processing", "Processing")}
          </Text>
          <Text className="mt-2 text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
            {processing.length}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl bg-card p-4 dark:bg-card-dark">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            {t("staff.ready", "Ready")}
          </Text>
          <Text className="mt-2 text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
            {ready.length}
          </Text>
        </View>
      </View>

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          {t("staff.processing_preview", "Processing Queue")}
        </Text>
        <View className="mt-3 gap-3">
          {processing.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/booking/[id]",
                  params: { id: item.id },
                })
              }
              className="rounded-xl border border-border px-4 py-3 dark:border-border-dark"
            >
              <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                {String(item.status || "").replaceAll("_", " ")}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                #{item.id.slice(0, 8)}
              </Text>
            </Pressable>
          ))}
          {processing.length === 0 ? (
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              {t("staff.processing_empty", "No processing bookings")}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          {t("staff.ready_preview", "Ready Queue")}
        </Text>
        <View className="mt-3 gap-3">
          {ready.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/booking/[id]",
                  params: { id: item.id },
                })
              }
              className="rounded-xl border border-border px-4 py-3 dark:border-border-dark"
            >
              <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                {String(item.status || "").replaceAll("_", " ")}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                #{item.id.slice(0, 8)}
              </Text>
            </Pressable>
          ))}
          {ready.length === 0 ? (
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              {t("staff.ready_empty", "No ready bookings")}
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
