import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { staffService, studentService } from "@/services/api";

function statusLabel(status?: string): string {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function timeLabel(value?: string): string {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Record<string, any> | null>(null);
  const [events, setEvents] = useState<Record<string, any>[]>([]);

  const isStaff = user?.role === "laundry_staff";
  const service = useMemo(
    () => (isStaff ? staffService : studentService),
    [isStaff],
  );

  const loadDetail = useMemo(
    () => async () => {
      if (!id) return;
      try {
        setError(null);
        setLoading(true);
        const [detail, timeline] = await Promise.all([
          service.getBookingByID(String(id)),
          service.getBookingEvents(String(id)),
        ]);
        setBooking(detail.booking || null);
        setEvents(timeline.events || []);
      } catch (e: any) {
        setError(
          e?.response?.data?.error || e?.message || "Failed to load booking",
        );
      } finally {
        setLoading(false);
      }
    },
    [id, service],
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
        <Text className="text-lg font-bold text-destructive dark:text-destructive-dark">
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background px-6 py-8 dark:bg-background-dark">
      <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        Booking Details
      </Text>

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Current Status
        </Text>
        <Text className="mt-2 text-2xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
          {statusLabel(String(booking?.status || ""))}
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          ID: #{String(booking?.id || "").slice(0, 8)}
        </Text>
        {booking?.row_no ? (
          <Text className="mt-2 text-sm font-semibold text-card-foreground dark:text-card-foreground-dark">
            Pickup Row: {String(booking.row_no)}
          </Text>
        ) : null}
      </View>

      <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Timeline
        </Text>
        <View className="mt-3 gap-3">
          {events.length === 0 ? (
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              No events recorded yet.
            </Text>
          ) : (
            events.map((evt) => (
              <View
                key={String(evt.id)}
                className="rounded-xl border border-border px-4 py-3 dark:border-border-dark"
              >
                <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                  {statusLabel(String(evt.event_type || ""))}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {timeLabel(String(evt.created_at || ""))}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {isStaff ? (
        <View className="mt-6 rounded-2xl bg-card p-5 dark:bg-card-dark">
          <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Staff phase transitions are scan-only. Use the Scan Center for
            intake, wash, dry, and ready steps.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
