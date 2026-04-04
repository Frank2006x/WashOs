import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { staffService, studentService } from "@/services/api";
import { SafeAreaView } from "react-native-safe-area-context";
import TrackingTimeline from "@/components/TrackingTimeline";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import QRScanner from "@/components/QRScanner";

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
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Record<string, any> | null>(null);
  const [events, setEvents] = useState<Record<string, any>[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);

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

  const handlePickupScan = useCallback(
    async (data: any) => {
      try {
        setPickupLoading(true);
        const qrCode = typeof data === "string" ? data : JSON.stringify(data);
        const verify = await studentService.pickupVerifyScan(qrCode);
        const bookingID = String(verify.booking?.id || "");
        if (!bookingID) {
          throw new Error("booking id not found from pickup verification");
        }
        await studentService.collectBooking(bookingID);
        await loadDetail();
        Alert.alert(
          "Success",
          "Pickup completed and order collected.",
        );
      } catch (e: any) {
        Alert.alert(
          "Error",
          e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.message ||
            "Failed to complete pickup.",
        );
      } finally {
        setPickupLoading(false);
      }
    },
    [loadDetail],
  );

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
      <View className="flex-row items-center px-4 py-3 bg-background dark:bg-background-dark border-b border-border dark:border-border-dark">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <MaterialCommunityIcons name="arrow-left" size={24} className="text-foreground dark:text-foreground-dark" color="#a1a1aa" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground dark:text-foreground-dark flex-1">
          Tracking Details
        </Text>
      </View>

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
            Order #{String(booking?.id || "").slice(0, 8)}
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            Full status and detailed timeline.
          </Text>
          {booking?.row_no ? (
            <View className="mt-4 self-start bg-primary/10 dark:bg-primary-dark/20 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-bold text-primary dark:text-primary-dark uppercase">
                Assigned Row: {String(booking.row_no)}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-5" : "p-6"}`}
        >
          {booking?.status ? (
            <TrackingTimeline
              currentStatus={String(booking.status)}
              orientation="vertical"
              showDetails={true}
              events={events}
            />
          ) : (
             <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
               Loading tracking data...
             </Text>
          )}
        </View>

        {!isStaff && booking?.status === "ready_for_pickup" ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              Checkout & Pickup
            </Text>
            <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Scan your laundry bag QR to verify possession and finalize checkout.
            </Text>

            {pickupLoading ? (
              <View className="mt-4 items-center justify-center h-48">
                <ActivityIndicator size="small" />
              </View>
            ) : (
              <View className="mt-4 overflow-hidden rounded-2xl border-2 border-primary-dark/30 dark:border-primary/30 shadow-sm h-64">
                <QRScanner title="Checkout Scan" onScan={handlePickupScan} showScanDetails={false} />
              </View>
            )}
          </View>
        ) : null}

        <View
          className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Raw Event Log
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
