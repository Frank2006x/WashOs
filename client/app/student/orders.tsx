import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { BookingRecord, studentService } from "@/services/api";
import QRScanner from "@/components/QRScanner";
import { SafeAreaView } from "react-native-safe-area-context";

type ActiveBookingState = Record<string, any> | null;

function getStatusLabel(status?: string): string {
  if (!status) return "Unknown";
  switch (status) {
    case "created":
      return "Created";
    case "dropped_off":
      return "Dropped Off";
    case "washing":
      return "Washing";
    case "wash_done":
      return "Wash Done";
    case "drying":
      return "Drying";
    case "dry_done":
      return "Dry Done";
    case "ready_for_pickup":
      return "Ready for Pickup";
    case "collected":
      return "Collected";
    default:
      return status;
  }
}

export default function StudentOrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [activeBooking, setActiveBooking] = useState<ActiveBookingState>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);

  const loadBooking = useCallback(async () => {
    try {
      setError(null);
      const [active, history] = await Promise.all([
        studentService.getMyActiveBooking(),
        studentService.listMyBookings(),
      ]);
      setActiveBooking(active.booking);
      setBookings(history.bookings || []);
    } catch (e: any) {
      setError(
        e?.response?.data?.error || e?.message || "Failed to load bookings",
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadBooking();
      setLoading(false);
    })();
  }, [loadBooking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBooking();
    setRefreshing(false);
  }, [loadBooking]);

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
        await loadBooking();
        Alert.alert(
          "Success",
          "Pickup completed and booking marked collected.",
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
    [loadBooking],
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
            {t("orders.title", "My Bookings")}
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            {t("orders.subtitle", "Track your latest laundry status.")}
          </Text>
        </View>

        {error ? (
          <View className="mt-6 rounded-2xl bg-destructive/10 p-4 dark:bg-destructive-dark/20">
            <Text className="font-medium text-destructive dark:text-destructive-dark">
              {error}
            </Text>
            <Pressable
              className="mt-3 self-start rounded-full bg-primary-dark px-4 py-2 dark:bg-primary"
              onPress={loadBooking}
            >
              <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
                {t("common.retry", "Retry")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!error && !activeBooking && bookings.length === 0 ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-lg font-bold text-card-foreground dark:text-card-foreground-dark">
              {t("orders.no_active", "No bookings yet")}
            </Text>
            <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              {t(
                "orders.no_active_desc",
                "Once staff receives your bag, booking history will appear here.",
              )}
            </Text>
          </View>
        ) : null}

        {!error && activeBooking ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              {t("orders.latest", "Latest Booking")}
            </Text>
            <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              {t("orders.status", "Status")}
            </Text>
            <Text className="text-xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
              {getStatusLabel(String(activeBooking.status || ""))}
            </Text>
            {activeBooking.row_no ? (
              <Text className="mt-2 text-sm font-semibold text-card-foreground dark:text-card-foreground-dark">
                Pickup Row: {String(activeBooking.row_no)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!error && activeBooking?.status === "ready_for_pickup" ? (
          <View
            className={`mt-6 rounded-2xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              Pickup Scan
            </Text>
            <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Scan your bag QR to verify and complete pickup.
            </Text>

            {pickupLoading ? (
              <View className="mt-4 items-center justify-center">
                <ActivityIndicator size="small" />
              </View>
            ) : (
              <View className="mt-4 overflow-hidden rounded-2xl">
                <QRScanner title="Pickup Scan" onScan={handlePickupScan} />
              </View>
            )}
          </View>
        ) : null}

        {!error && bookings.length > 0 ? (
          <View
            className={`mt-6 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              {t("orders.history", "Booking History")}
            </Text>
            <View className="mt-3 gap-3">
              {bookings.map((booking) => (
                <Pressable
                  key={booking.id}
                  onPress={() =>
                    router.push({
                      pathname: "/booking/[id]",
                      params: { id: booking.id },
                    })
                  }
                  className={`rounded-2xl border border-border bg-background dark:border-border-dark dark:bg-background-dark ${isCompact ? "px-3 py-3" : "px-4 py-4"}`}
                >
                  <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                    {getStatusLabel(booking.status)}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    #{booking.id.slice(0, 8)}
                  </Text>
                  {booking.row_no ? (
                    <Text className="mt-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                      Pickup Row: {String(booking.row_no)}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
