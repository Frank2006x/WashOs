import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AvailableSlotsResponse,
  SlotReservationRecord,
  SlotWindow,
  studentService,
} from "@/services/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";

function formatDateLocal(ts?: string): string {
  if (!ts) return "-";
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString();
}

function formatTimeLocal(ts?: string): string {
  if (!ts) return "-";
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function istDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function StudentSlotsScreen() {
  const [selectedDate, setSelectedDate] = useState(istDateString(new Date()));
  const [available, setAvailable] = useState(
    null as AvailableSlotsResponse | null,
  );
  const [reservations, setReservations] = useState(
    [] as SlotReservationRecord[],
  );
  const [selectedSlotID, setSelectedSlotID] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [cancelBusyID, setCancelBusyID] = useState("");
  const [error, setError] = useState(null as string | null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [slotsRes, myBookings] = await Promise.all([
        studentService.listAvailableSlots(selectedDate),
        studentService.listMySlotReservations(30, 0),
      ]);

      setAvailable(slotsRes);
      setReservations(myBookings.reservations || []);

      const slots = slotsRes.slots || [];
      if (!slots.length) {
        setSelectedSlotID("");
        return;
      }

      // Prefer an active or upcoming slot to reduce no-show risk before intake.
      const now = new Date();
      const picked =
        slots.find((s) => {
          const start = new Date(s.start_at);
          const end = new Date(s.end_at);
          return now >= start && now < end;
        }) ||
        slots.find((s) => now < new Date(s.end_at)) ||
        slots[0];

      setSelectedSlotID((prev) => prev || picked.slot_window_id);
    } catch (e: any) {
      setError(
        e?.response?.data?.error || e?.message || "Failed to load slots",
      );
      setAvailable(null);
      setReservations([]);
      setSelectedSlotID("");
    }
  }, [selectedDate]);

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

  const slots = useMemo(() => available?.slots || [], [available]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.slot_window_id === selectedSlotID) || null,
    [slots, selectedSlotID],
  ) as SlotWindow | null;

  const activeReservation = useMemo(() => {
    return reservations.find((r) =>
      ["booked", "checked_in"].includes(String(r.status)),
    );
  }, [reservations]);

  const changeDate = useCallback(
    (delta: number) => {
      const base = new Date(selectedDate + "T00:00:00+05:30");
      base.setDate(base.getDate() + delta);
      setSelectedDate(istDateString(base));
      setSelectedSlotID("");
    },
    [selectedDate],
  );

  const onBookSlot = useCallback(async () => {
    if (!selectedSlotID) {
      Alert.alert("Pick a slot", "Please select a slot window before booking.");
      return;
    }

    try {
      setBookingBusy(true);
      await studentService.bookSlot(selectedSlotID);
      await load();
      Alert.alert("Booked", "Your intake slot is confirmed.");
    } catch (e: any) {
      Alert.alert(
        "Booking failed",
        e?.response?.data?.error || e?.message || "Could not book this slot.",
      );
    } finally {
      setBookingBusy(false);
    }
  }, [load, selectedSlotID]);

  const onCancelReservation = useCallback(
    async (reservationID: string) => {
      try {
        setCancelBusyID(reservationID);
        await studentService.cancelSlotReservation(reservationID);
        await load();
        Alert.alert("Cancelled", "Your slot booking was cancelled.");
      } catch (e: any) {
        Alert.alert(
          "Cancel failed",
          e?.response?.data?.error ||
            e?.message ||
            "Could not cancel slot booking.",
        );
      } finally {
        setCancelBusyID("");
      }
    },
    [load],
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
        contentContainerClassName="px-5 py-5 pb-24"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl bg-card p-5 dark:bg-card-dark">
          <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
            Slot Booking
          </Text>
          <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Book a valid intake window before staff scans your bag.
          </Text>
        </View>

        {error ? (
          <View className="mt-4 rounded-2xl bg-destructive/10 p-4 dark:bg-destructive-dark/20">
            <Text className="font-medium text-destructive dark:text-destructive-dark">
              {error}
            </Text>
          </View>
        ) : null}

        <View className="mt-5 rounded-3xl bg-card p-4 dark:bg-card-dark">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Select Date
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Pressable
              className="rounded-full bg-muted px-4 py-2 dark:bg-muted-dark"
              onPress={() => changeDate(-1)}
            >
              <Text className="font-bold text-card-foreground dark:text-card-foreground-dark">
                Prev
              </Text>
            </Pressable>

            <Text className="text-base font-extrabold text-card-foreground dark:text-card-foreground-dark">
              {selectedDate}
            </Text>

            <Pressable
              className="rounded-full bg-muted px-4 py-2 dark:bg-muted-dark"
              onPress={() => changeDate(1)}
            >
              <Text className="font-bold text-card-foreground dark:text-card-foreground-dark">
                Next
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-5 rounded-3xl bg-card p-4 dark:bg-card-dark">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Current Reservation
          </Text>

          {!activeReservation ? (
            <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              No active booking found.
            </Text>
          ) : (
            <View className="mt-3 rounded-2xl border border-border bg-background p-4 dark:border-border-dark dark:bg-background-dark">
              <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                {String(activeReservation.status)
                  .replaceAll("_", " ")
                  .toUpperCase()}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                {formatDateLocal(activeReservation.start_at)} •{" "}
                {formatTimeLocal(activeReservation.start_at)} -{" "}
                {formatTimeLocal(activeReservation.end_at)}
              </Text>
              {activeReservation.status === "booked" ? (
                <Pressable
                  className="mt-3 self-start rounded-full bg-destructive px-4 py-2"
                  onPress={() =>
                    onCancelReservation(activeReservation.reservation_id)
                  }
                  disabled={cancelBusyID === activeReservation.reservation_id}
                >
                  <Text className="font-bold text-destructive-foreground">
                    {cancelBusyID === activeReservation.reservation_id
                      ? "Cancelling..."
                      : "Cancel Booking"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View className="mt-5 rounded-3xl bg-card p-4 dark:bg-card-dark">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Available Slots
          </Text>
          <Text className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
            Daily booked: {available?.daily_booked_reservations || 0} /{" "}
            {available?.daily_booking_limit || 600}
          </Text>

          {slots.length === 0 ? (
            <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              No slots available for this date and floor.
            </Text>
          ) : (
            <View className="mt-3 gap-3">
              {slots.map((slot) => {
                const selected = slot.slot_window_id === selectedSlotID;
                return (
                  <Pressable
                    key={slot.slot_window_id}
                    onPress={() => setSelectedSlotID(slot.slot_window_id)}
                    className={`rounded-2xl border p-4 ${
                      selected
                        ? "border-primary bg-primary/10 dark:border-primary-dark dark:bg-primary-dark/20"
                        : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
                        {formatTimeLocal(slot.start_at)} -{" "}
                        {formatTimeLocal(slot.end_at)}
                      </Text>
                      {selected ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color="#22c55e"
                        />
                      ) : null}
                    </View>
                    <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      Floors {slot.allowed_start_floor}-{slot.allowed_end_floor}{" "}
                      • Remaining {slot.remaining_capacity}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            className={`mt-4 items-center rounded-2xl px-4 py-3 ${
              bookingBusy || !selectedSlot || !!activeReservation
                ? "bg-muted dark:bg-muted-dark"
                : "bg-primary dark:bg-primary-dark"
            }`}
            disabled={bookingBusy || !selectedSlot || !!activeReservation}
            onPress={onBookSlot}
          >
            <Text
              className={`font-bold ${
                bookingBusy || !selectedSlot || !!activeReservation
                  ? "text-muted-foreground dark:text-muted-foreground-dark"
                  : "text-primary-foreground dark:text-primary-foreground-dark"
              }`}
            >
              {bookingBusy
                ? "Booking..."
                : activeReservation
                  ? "You already have an active booking"
                  : "Book Selected Slot"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
