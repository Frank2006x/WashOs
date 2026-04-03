import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { staffService, studentService } from "@/services/api";
import { SafeAreaView } from "react-native-safe-area-context";

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

function getMachineLabel(evt: Record<string, any>): string {
  const payload = evt?.metadata;
  let metadata: Record<string, any> = {};

  if (payload && typeof payload === "object") {
    metadata = payload;
  } else if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") {
        metadata = parsed;
      }
    } catch {
      metadata = {};
    }
  }

  const machineCode = metadata?.machine_code;
  if (typeof machineCode === "string" && machineCode.trim().length > 0) {
    return machineCode.trim();
  }

  return "";
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
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
      <SafeAreaView
        className="flex-1 bg-background px-6 py-8 dark:bg-background-dark"
        edges={["top"]}
      >
        <Text className="text-lg font-bold text-destructive dark:text-destructive-dark">
          {error}
        </Text>
      </SafeAreaView>
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
        showsVerticalScrollIndicator={false}
      >
        <View
          className={`rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-5" : "p-6"}`}
        >
          <Text
            className={`${isCompact ? "text-2xl" : "text-3xl"} font-extrabold text-card-foreground dark:text-card-foreground-dark`}
          >
            Booking Details
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            Full status and timeline for this booking.
          </Text>
        </View>

        <View
          className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
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

        <View
          className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Timeline
          </Text>
          <View className="mt-3 gap-3">
            {events.length === 0 ? (
              <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                No events recorded yet.
              </Text>
            ) : (
              events.map((evt) => {
                const machineLabel = getMachineLabel(evt);
                return (
                  <View
                    key={String(evt.id)}
                    className={`rounded-2xl border border-border bg-background dark:border-border-dark dark:bg-background-dark ${isCompact ? "px-3 py-2.5" : "px-4 py-3"}`}
                  >
                    <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                      {statusLabel(String(evt.event_type || ""))}
                    </Text>
                    {machineLabel ? (
                      <Text className="mt-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                        Machine: {machineLabel}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {timeLabel(String(evt.created_at || ""))}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {isStaff ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Staff phase transitions are scan-only. Use the Scan Center for
              intake, wash, dry, and ready steps.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
