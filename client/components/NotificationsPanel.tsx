import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  NotificationRecord,
  staffService,
  studentService,
} from "@/services/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

function formatDate(value?: string): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
}

function extractRowNo(payload: unknown): string | null {
  if (!payload) return null;

  let obj: any = payload;
  if (typeof payload === "string") {
    try {
      obj = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (!obj || typeof obj !== "object") return null;

  const direct = obj.row_no ?? obj.rowNo ?? obj.pickup_row ?? obj.pickupRow;
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
    return String(direct);
  }

  const nested =
    obj.booking?.row_no ??
    obj.booking?.rowNo ??
    obj.data?.row_no ??
    obj.data?.rowNo;
  if (nested !== undefined && nested !== null && String(nested).trim() !== "") {
    return String(nested);
  }

  return null;
}

export default function NotificationsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const service = useMemo(
    () => (user?.role === "laundry_staff" ? staffService : studentService),
    [user?.role],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRecord[]>([]);

  const unreadItems = useMemo(() => items.filter((it) => !it.is_read), [items]);
  const readItems = useMemo(() => items.filter((it) => it.is_read), [items]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await service.listNotifications();
      setItems(res.notifications || []);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.message ||
          t("notifications.failed_load", "Failed to load notifications"),
      );
    }
  }, [service, t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onMarkRead = useCallback(
    async (id: string) => {
      try {
        await service.markNotificationRead(id);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : it,
          ),
        );
      } catch (e: any) {
        setError(
          e?.response?.data?.error ||
            e?.message ||
            t("notifications.failed_mark_read", "Failed to mark notification as read"),
        );
      }
    },
    [service, t],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          className={`rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-5" : "p-6"}`}
        >
          <Text
            className={`${isCompact ? "text-2xl" : "text-3xl"} font-extrabold text-card-foreground dark:text-card-foreground-dark`}
          >
            {t("notifications.title", "Notifications")}
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            {t("notifications.subtitle", "Track unread alerts and your read history.")}
          </Text>
        </View>

        {error ? (
          <View className="mt-4 rounded-xl bg-destructive/10 p-4 dark:bg-destructive-dark/20">
            <Text className="font-medium text-destructive dark:text-destructive-dark">
              {error}
            </Text>
          </View>
        ) : null}

        {items.length === 0 ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-base font-bold text-card-foreground dark:text-card-foreground-dark">
              {t("notifications.no_notifications", "No notifications yet")}
            </Text>
          </View>
        ) : (
          <>
            <View
              className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
            >
              <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                {t("notifications.unread_title", "Unread ({{count}})", { count: unreadItems.length })}
              </Text>
              <View className="mt-3 gap-3">
                {unreadItems.length === 0 ? (
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    {t("notifications.no_unread", "No unread notifications.")}
                  </Text>
                ) : (
                  unreadItems.map((item) => {
                    const rowNo = extractRowNo(item.payload);
                    return (
                      <View
                        key={item.id}
                        className={`flex-row items-start rounded-2xl border-l-4 border-l-blue-500 border border-border bg-background dark:border-border-dark dark:bg-background-dark ${isCompact ? "p-3" : "p-4"}`}
                      >
                        <View className="mr-3 mt-1 bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full">
                          <MaterialCommunityIcons
                            name="bell-ring"
                            size={20}
                            color="#3b82f6"
                          />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-start justify-between">
                            <Text className="text-base font-extrabold text-card-foreground dark:text-card-foreground-dark flex-1 mr-2">
                              {item.title}
                            </Text>
                            <Text className="text-[10px] uppercase font-bold text-blue-500 mt-1">
                              {t("notifications.new_badge", "New")}
                            </Text>
                          </View>
                          <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark leading-5">
                            {item.message}
                          </Text>
                          {rowNo ? (
                            <View className="mt-2 self-start bg-primary/10 dark:bg-primary-dark/20 px-3 py-1 rounded-full">
                              <Text className="text-xs font-bold text-primary dark:text-primary-dark uppercase">
                                {t("notifications.row_label", "Row: {{row}}", { row: String(rowNo) })}
                              </Text>
                            </View>
                          ) : null}
                          <View className="mt-3 flex-row items-center justify-between">
                            <Text className="text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground-dark">
                              {formatDate(item.created_at)}
                            </Text>
                            <Pressable
                              className="flex-row items-center bg-muted dark:bg-muted-dark px-3 py-1.5 rounded-full"
                              onPress={() => onMarkRead(item.id)}
                            >
                              <MaterialCommunityIcons
                                name="check-all"
                                size={14}
                                color="#a1a1aa"
                                className="mr-1"
                              />
                              <Text className="text-xs font-bold text-muted-foreground dark:text-muted-foreground-dark ml-1">
                                {t("notifications.mark_read_button", "Mark Read")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            <View
              className={`mt-4 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
            >
              <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                {t("notifications.read_title", "Read ({{count}})", { count: readItems.length })}
              </Text>
              <View className="mt-3 gap-3">
                {readItems.length === 0 ? (
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    {t("notifications.no_read", "No read notifications.")}
                  </Text>
                ) : (
                  readItems.map((item) => {
                    const rowNo = extractRowNo(item.payload);
                    return (
                      <View
                        key={item.id}
                        className={`flex-row items-start rounded-2xl border border-border bg-muted/30 dark:border-border-dark dark:bg-muted-dark/20 opacity-80 ${isCompact ? "p-3" : "p-4"}`}
                      >
                        <View className="mr-3 mt-1 bg-muted dark:bg-muted-dark p-2 rounded-full">
                          <MaterialCommunityIcons
                            name="bell-outline"
                            size={20}
                            color="#a1a1aa"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-bold text-muted-foreground dark:text-muted-foreground-dark">
                            {item.title}
                          </Text>
                          <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark leading-5">
                            {item.message}
                          </Text>
                          {rowNo ? (
                            <View className="mt-2 self-start bg-border dark:bg-border-dark px-3 py-1 rounded-full">
                              <Text className="text-xs font-bold text-muted-foreground dark:text-muted-foreground-dark uppercase">
                                {t("notifications.row_label", "Row: {{row}}", { row: String(rowNo) })}
                              </Text>
                            </View>
                          ) : null}
                          <Text className="mt-3 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground-dark">
                            {formatDate(item.created_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
