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
import {
  NotificationRecord,
  staffService,
  studentService,
} from "@/services/api";
import { SafeAreaView } from "react-native-safe-area-context";

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
          "Failed to load notifications",
      );
    }
  }, [service]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

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
            "Failed to mark notification as read",
        );
      }
    },
    [service],
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
            Notifications
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            Track unread alerts and your read history.
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
              No notifications yet
            </Text>
          </View>
        ) : (
          <>
            <View
              className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
            >
              <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                Unread ({unreadItems.length})
              </Text>
              <View className="mt-3 gap-3">
                {unreadItems.length === 0 ? (
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    No unread notifications.
                  </Text>
                ) : (
                  unreadItems.map((item) => {
                    const rowNo = extractRowNo(item.payload);
                    return (
                      <View
                        key={item.id}
                        className={`rounded-2xl border border-border bg-background dark:border-border-dark dark:bg-background-dark ${isCompact ? "p-3" : "p-4"}`}
                      >
                        <Text className="text-base font-bold text-card-foreground dark:text-card-foreground-dark">
                          {item.title}
                        </Text>
                        <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                          {item.message}
                        </Text>
                        {rowNo ? (
                          <Text className="mt-2 text-sm font-semibold text-card-foreground dark:text-card-foreground-dark">
                            Pickup Row: {String(rowNo)}
                          </Text>
                        ) : null}
                        <Text className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                          {formatDate(item.created_at)}
                        </Text>
                        <Pressable
                          className="mt-3 self-start rounded-full bg-primary-dark px-4 py-2 dark:bg-primary"
                          onPress={() => onMarkRead(item.id)}
                        >
                          <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
                            Mark as read
                          </Text>
                        </Pressable>
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
                Read ({readItems.length})
              </Text>
              <View className="mt-3 gap-3">
                {readItems.length === 0 ? (
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    No read notifications.
                  </Text>
                ) : (
                  readItems.map((item) => {
                    const rowNo = extractRowNo(item.payload);
                    return (
                      <View
                        key={item.id}
                        className={`rounded-2xl border border-border bg-background opacity-85 dark:border-border-dark dark:bg-background-dark ${isCompact ? "p-3" : "p-4"}`}
                      >
                        <Text className="text-base font-bold text-card-foreground dark:text-card-foreground-dark">
                          {item.title}
                        </Text>
                        <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                          {item.message}
                        </Text>
                        {rowNo ? (
                          <Text className="mt-2 text-sm font-semibold text-card-foreground dark:text-card-foreground-dark">
                            Pickup Row: {String(rowNo)}
                          </Text>
                        ) : null}
                        <Text className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                          {formatDate(item.created_at)}
                        </Text>
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
