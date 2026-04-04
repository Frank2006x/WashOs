import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookingRecord,
  QueryDetailResponse,
  QueryRecord,
  studentService,
} from "@/services/api";

function statusTone(status: string): string {
  switch (status) {
    case "open":
      return "text-amber-500";
    case "acknowledged":
      return "text-blue-500";
    case "resolved":
      return "text-emerald-500";
    case "closed":
      return "text-zinc-500";
    default:
      return "text-zinc-500";
  }
}

export default function StudentQueriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [queries, setQueries] = useState<QueryRecord[]>([]);
  const [selectedQueryID, setSelectedQueryID] = useState("");
  const [loadingQueryID, setLoadingQueryID] = useState("");
  const [queryDetails, setQueryDetails] = useState<
    Record<string, QueryDetailResponse>
  >({});
  const [selectedBookingID, setSelectedBookingID] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceRating, setServiceRating] = useState("3");
  const [handlingRating, setHandlingRating] = useState("3");
  const [imageUri, setImageUri] = useState("");

  const ensureBookingSelected = useCallback(
    (nextBookings: BookingRecord[]) => {
      if (nextBookings.length === 0) {
        setSelectedBookingID("");
        return;
      }

      const selectedExists = nextBookings.some(
        (b) => String(b.id) === String(selectedBookingID),
      );

      if (!selectedBookingID || !selectedExists) {
        setSelectedBookingID(String(nextBookings[0].id));
      }
    },
    [selectedBookingID],
  );

  const load = useCallback(async () => {
    const [bookingRes, activeRes, queryRes] = await Promise.all([
      studentService.listMyBookings(50, 0),
      studentService.getMyActiveBooking(),
      studentService.listMyQueries(50, 0),
    ]);

    const history = bookingRes.bookings || [];
    const active = activeRes.booking as BookingRecord | null;

    const merged: BookingRecord[] = [...history];
    if (active?.id) {
      const exists = merged.some((b) => String(b.id) === String(active.id));
      if (!exists) {
        merged.unshift(active);
      }
    }

    setBookings(merged);
    setQueries(queryRes.queries || []);
    ensureBookingSelected(merged);
  }, [ensureBookingSelected]);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e: any) {
        Alert.alert(
          "Error",
          e?.response?.data?.error || e?.message || "Failed to load queries",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const clearForm = () => {
    setTitle("");
    setDescription("");
    setImageUri("");
    setServiceRating("3");
    setHandlingRating("3");
  };

  const submit = useCallback(async () => {
    const missing: string[] = [];
    if (!selectedBookingID) missing.push("booking");
    if (!title.trim()) missing.push("title");
    if (!description.trim()) missing.push("description");
    if (!imageUri) missing.push("image");

    if (missing.length > 0) {
      Alert.alert("Missing fields", `Please add: ${missing.join(", ")}.`);
      return;
    }

    const sr = Number(serviceRating);
    const hr = Number(handlingRating);
    if (
      Number.isNaN(sr) ||
      sr < 1 ||
      sr > 5 ||
      Number.isNaN(hr) ||
      hr < 1 ||
      hr > 5
    ) {
      Alert.alert("Invalid ratings", "Ratings must be between 1 and 5.");
      return;
    }

    try {
      setSubmitting(true);
      await studentService.raiseQueryWithImage({
        booking_id: selectedBookingID,
        title: title.trim(),
        description: description.trim(),
        service_rating: sr,
        handling_rating: hr,
        image: {
          uri: imageUri,
          type: "image/jpeg",
          name: `query-${Date.now()}.jpg`,
        },
      });
      clearForm();
      await load();
      Alert.alert("Success", "Query raised successfully.");
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || e?.message || "Failed to raise query.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedBookingID,
    title,
    description,
    imageUri,
    serviceRating,
    handlingRating,
    load,
  ]);

  const queryCards = useMemo(() => queries, [queries]);

  const openQuery = useCallback(
    async (queryID: string) => {
      if (selectedQueryID === queryID) {
        setSelectedQueryID("");
        return;
      }

      setSelectedQueryID(queryID);
      if (queryDetails[queryID]) {
        return;
      }

      try {
        setLoadingQueryID(queryID);
        const details = await studentService.getMyQuery(queryID);
        setQueryDetails((prev) => ({ ...prev, [queryID]: details }));
      } catch (e: any) {
        Alert.alert(
          "Error",
          e?.response?.data?.error ||
            e?.message ||
            "Failed to load query replies",
        );
      } finally {
        setLoadingQueryID("");
      }
    },
    [queryDetails, selectedQueryID],
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
        contentContainerClassName="px-4 py-4 pb-24"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="rounded-3xl bg-card p-5 dark:bg-card-dark">
          <Text className="text-2xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
            Raise Query
          </Text>
          <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Report issue with photo and ratings.
          </Text>

          <Text className="mt-4 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Booking
          </Text>
          {bookings.length === 0 ? (
            <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              No booking found yet. Ask staff to intake your bag first.
            </Text>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2"
          >
            <View className="flex-row gap-2">
              {bookings.map((b) => {
                const active = String(b.id) === String(selectedBookingID);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setSelectedBookingID(String(b.id))}
                    className={`rounded-full border px-4 py-2 ${active ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
                  >
                    <Text
                      className={`${active ? "text-primary" : "text-card-foreground dark:text-card-foreground-dark"} font-semibold`}
                    >
                      #{String(b.id).slice(0, 8)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your issue"
            multiline
            numberOfLines={4}
            className="mt-3 rounded-xl border border-border bg-background px-4 py-3 text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
          />

          <Text className="mt-4 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Ratings (1-5)
          </Text>
          <View className="mt-2 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                Service Rating
              </Text>
              <TextInput
                value={serviceRating}
                onChangeText={setServiceRating}
                keyboardType="numeric"
                placeholder="1-5"
                className="rounded-xl border border-border bg-background px-4 py-3 text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-semibold text-card-foreground dark:text-card-foreground-dark">
                Handling Rating
              </Text>
              <TextInput
                value={handlingRating}
                onChangeText={setHandlingRating}
                keyboardType="numeric"
                placeholder="1-5"
                className="rounded-xl border border-border bg-background px-4 py-3 text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
              />
            </View>
          </View>

          <Pressable
            onPress={pickImage}
            className="mt-3 rounded-xl border border-border px-4 py-3 dark:border-border-dark"
          >
            <Text className="font-semibold text-card-foreground dark:text-card-foreground-dark">
              {imageUri ? "Change image" : "Pick image"}
            </Text>
          </Pressable>

          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              className="mt-3 h-40 w-full rounded-xl"
              resizeMode="cover"
            />
          ) : null}

          <Pressable
            onPress={submit}
            disabled={submitting || bookings.length === 0}
            className={`mt-4 items-center rounded-full px-5 py-3 ${submitting || bookings.length === 0 ? "bg-muted dark:bg-muted-dark" : "bg-primary-dark dark:bg-primary"}`}
          >
            <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
              {submitting ? "Submitting..." : "Raise Query"}
            </Text>
          </Pressable>
        </View>

        <View className="mt-6 rounded-3xl bg-card p-5 dark:bg-card-dark">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            My Queries
          </Text>

          {queryCards.length === 0 ? (
            <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              No queries raised yet.
            </Text>
          ) : (
            <View className="mt-3 gap-3">
              {queryCards.map((q) => (
                <Pressable
                  key={q.id}
                  onPress={() => openQuery(q.id)}
                  className="rounded-2xl border border-border p-4 dark:border-border-dark"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-card-foreground dark:text-card-foreground-dark">
                      {q.title}
                    </Text>
                    <Text className={`font-bold ${statusTone(q.status)}`}>
                      {q.status}
                    </Text>
                  </View>
                  <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    {q.description}
                  </Text>
                  {q.image_url ? (
                    <Image
                      source={{ uri: q.image_url }}
                      className="mt-3 h-36 w-full rounded-xl"
                      resizeMode="cover"
                    />
                  ) : null}

                  {selectedQueryID === q.id ? (
                    <View className="mt-4 rounded-xl bg-background p-3 dark:bg-background-dark">
                      <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                        Staff Replies
                      </Text>

                      {loadingQueryID === q.id ? (
                        <View className="mt-3">
                          <ActivityIndicator size="small" />
                        </View>
                      ) : (
                        <View className="mt-3 gap-2">
                          {(queryDetails[q.id]?.replies || []).length === 0 ? (
                            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                              No reply yet.
                            </Text>
                          ) : (
                            (queryDetails[q.id]?.replies || []).map((r) => (
                              <View
                                key={r.id}
                                className="rounded-lg border border-border p-3 dark:border-border-dark"
                              >
                                <Text className="text-sm text-card-foreground dark:text-card-foreground-dark">
                                  {r.message}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
