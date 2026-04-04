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
import { useTranslation } from "react-i18next";

function statusLabel(status?: string, t?: any): string {
  if (!status) return t ? t("common.unknown", "Unknown") : "Unknown";
  if (t) {
    const translated = t(`common.statuses.${status}`);
    if (translated && translated !== `common.statuses.${status}`) {
      return translated;
    }
  }
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function timeLabel(value?: string): string {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function getEventDetailLabel(evt: Record<string, any>): string {
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
    return `Machine: ${machineCode.trim()}`;
  }

  const rowNo = metadata?.row_no;
  if (typeof rowNo === "string" && rowNo.trim().length > 0) {
    return `Row: ${rowNo.trim()}`;
  }

  return "";
}

export default function BookingDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const scanAreaSize = Math.max(
    220,
    Math.min(width - (isCompact ? 48 : 64), 360),
  );
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
          e?.response?.data?.error ||
            e?.message ||
            t("booking.failed_load", "Failed to load booking"),
        );
      } finally {
        setLoading(false);
      }
    },
    [id, service, t],
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
          throw new Error(
            t(
              "booking.err_id_not_found",
              "booking id not found from pickup verification",
            ),
          );
        }
        await studentService.collectBooking(bookingID);
        await loadDetail();
        Alert.alert(
          t("common.success", "Success"),
          t("booking.pickup_success", "Pickup completed and order collected."),
        );
      } catch (e: any) {
        Alert.alert(
          t("common.error", "Error"),
          e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.message ||
            t("booking.pickup_failed", "Failed to complete pickup."),
        );
      } finally {
        setPickupLoading(false);
      }
    },
    [loadDetail, t],
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
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            className="text-foreground dark:text-foreground-dark"
            color="#a1a1aa"
          />
        </Pressable>
        <Text className="text-lg font-bold text-foreground dark:text-foreground-dark flex-1">
          {t("booking.tracking_details", "Tracking Details")}
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
            {t("booking.order_number", "Order #")}
            {String(booking?.id || "").slice(0, 8)}
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            {t("booking.order_subtitle", "Full status and detailed timeline.")}
          </Text>
          {booking?.row_no ? (
            <View className="mt-4 self-start bg-primary/10 dark:bg-primary-dark/20 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-bold text-primary dark:text-primary-dark uppercase">
                {t("booking.assigned_row", "Assigned Row: {{row}}", {
                  row: String(booking.row_no),
                })}
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
              {t("booking.loading_tracking", "Loading tracking data...")}
            </Text>
          )}
        </View>

        {!isStaff && booking?.status === "ready_for_pickup" ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              {t("booking.checkout_title", "Checkout & Pickup")}
            </Text>
            <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              {t(
                "booking.checkout_desc",
                "Scan your laundry bag QR to verify possession and finalize checkout.",
              )}
            </Text>

            {pickupLoading ? (
              <View className="mt-4 items-center justify-center h-48">
                <ActivityIndicator size="small" />
              </View>
            ) : (
              <View
                className="mt-4 self-center overflow-hidden rounded-2xl border-2 border-primary-dark/30 dark:border-primary/30 shadow-sm"
                style={{ width: scanAreaSize, height: scanAreaSize }}
              >
                <QRScanner
                  title={
                    t("booking.checkout_scan_title", "Checkout Scan") as string
                  }
                  onScan={handlePickupScan}
                  showScanDetails={false}
                />
              </View>
            )}
          </View>
        ) : null}

        <View
          className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            {t("booking.raw_log_title", "Raw Event Log")}
          </Text>
          <View className="mt-3 gap-3">
            {events.length === 0 ? (
              <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                {t("booking.no_events", "No events recorded yet.")}
              </Text>
            ) : (
              events.map((evt) => {
                const eventDetailLabel = getEventDetailLabel(evt);
                return (
                  <View
                    key={String(evt.id)}
                    className={`rounded-2xl border border-border bg-background dark:border-border-dark dark:bg-background-dark ${isCompact ? "px-3 py-2.5" : "px-4 py-3"}`}
                  >
                    <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                      {statusLabel(String(evt.event_type || ""), t)}
                    </Text>
                    {eventDetailLabel ? (
                      <Text className="mt-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                        {eventDetailLabel}
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
              {t(
                "booking.staff_hint",
                "Staff phase transitions are scan-only. Use the Scan Center for intake, wash, dry, and ready steps.",
              )}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
