import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  BookingRecord,
  studentService,
  BookingEventsResponse,
} from "@/services/api";

type EventRecord = Record<string, any>;

function statusLabel(status?: string): string {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatTime(ts?: string): string {
  if (!ts) return "";
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
}

export default function StudentHomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Record<
    string,
    any
  > | null>(null);
  const [history, setHistory] = useState<BookingRecord[]>([]);
  const [eventsByBooking, setEventsByBooking] = useState<
    Record<string, EventRecord[]>
  >({});

  const bookingCards = useMemo(() => {
    const activeId = activeBooking?.id ? String(activeBooking.id) : "";
    return history.filter((b) => String(b.id) !== activeId);
  }, [history, activeBooking?.id]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [activeRes, historyRes] = await Promise.all([
        studentService.getMyActiveBooking(),
        studentService.listMyBookings(50, 0),
      ]);

      const bookings = historyRes.bookings || [];
      setActiveBooking(activeRes.booking || null);
      setHistory(bookings);

      const eventPairs: Array<[string, EventRecord[]]> = await Promise.all(
        bookings.map(async (booking) => {
          try {
            const ev: BookingEventsResponse =
              await studentService.getBookingEvents(booking.id);
            return [booking.id, ev.events || []];
          } catch {
            return [booking.id, []];
          }
        }),
      );

      const map: Record<string, EventRecord[]> = {};
      for (const [id, events] of eventPairs) {
        map[id] = events;
      }
      setEventsByBooking(map);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load home");
    }
  }, []);

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
        Student Home
      </Text>
      <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Current laundry and full past history with timeline updates.
      </Text>

      {error ? (
        <View className="mt-4 rounded-2xl bg-destructive/10 p-4 dark:bg-destructive-dark/20">
          <Text className="font-medium text-destructive dark:text-destructive-dark">
            {error}
          </Text>
        </View>
      ) : null}

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Current Booking
        </Text>

        {!activeBooking ? (
          <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            No active booking right now.
          </Text>
        ) : (
          <Pressable
            className="mt-3 rounded-xl border border-border px-4 py-3 dark:border-border-dark"
            onPress={() =>
              router.push({
                pathname: "/booking/[id]",
                params: { id: activeBooking.id },
              })
            }
          >
            <Text className="text-base font-bold text-card-foreground dark:text-card-foreground-dark">
              {statusLabel(String(activeBooking.status || ""))}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
              #{String(activeBooking.id || "").slice(0, 8)}
            </Text>
            {activeBooking.row_no ? (
              <Text className="mt-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                Pickup Row: {String(activeBooking.row_no)}
              </Text>
            ) : null}
            <View className="mt-3 gap-2">
              {(eventsByBooking[String(activeBooking.id)] || [])
                .slice(-4)
                .map((evt) => (
                  <View
                    key={String(evt.id)}
                    className="rounded-lg bg-background px-3 py-2 dark:bg-background-dark"
                  >
                    <Text className="text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                      {statusLabel(String(evt.event_type || ""))}
                    </Text>
                    <Text className="mt-1 text-[11px] text-muted-foreground dark:text-muted-foreground-dark">
                      {formatTime(String(evt.created_at || ""))}
                    </Text>
                  </View>
                ))}
            </View>
          </Pressable>
        )}
      </View>

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Past Laundry
        </Text>

        {bookingCards.length === 0 ? (
          <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            No past bookings yet.
          </Text>
        ) : (
          <View className="mt-3 gap-3">
            {bookingCards.map((booking) => (
              <Pressable
                key={booking.id}
                onPress={() =>
                  router.push({
                    pathname: "/booking/[id]",
                    params: { id: booking.id },
                  })
                }
                className="rounded-xl border border-border px-4 py-3 dark:border-border-dark"
              >
                <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                  {statusLabel(booking.status)}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  #{booking.id.slice(0, 8)}
                </Text>
                {booking.row_no ? (
                  <Text className="mt-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                    Pickup Row: {String(booking.row_no)}
                  </Text>
                ) : null}
                <View className="mt-3 gap-2">
                  {(eventsByBooking[booking.id] || []).slice(-4).map((evt) => (
                    <View
                      key={String(evt.id)}
                      className="rounded-lg bg-background px-3 py-2 dark:bg-background-dark"
                    >
                      <Text className="text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                        {statusLabel(String(evt.event_type || ""))}
                      </Text>
                      <Text className="mt-1 text-[11px] text-muted-foreground dark:text-muted-foreground-dark">
                        {formatTime(String(evt.created_at || ""))}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
