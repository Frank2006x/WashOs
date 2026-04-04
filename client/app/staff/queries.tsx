import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { QueryDetailResponse, QueryRecord, staffService } from "@/services/api";

export default function StaffQueriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queries, setQueries] = useState<QueryRecord[]>([]);
  const [selected, setSelected] = useState<QueryDetailResponse | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await staffService.listQueries(50, 0);
    setQueries(list.queries || []);

    if (selected?.query?.id) {
      try {
        const details = await staffService.getQuery(selected.query.id);
        setSelected(details);
      } catch {
        setSelected(null);
      }
    }
  }, [selected?.query?.id]);

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

  const openDetails = async (queryID: string) => {
    try {
      const details = await staffService.getQuery(queryID);
      setSelected(details);
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.error ||
          e?.message ||
          "Failed to load query details",
      );
    }
  };

  const act = async (fn: () => Promise<any>, successMsg: string) => {
    if (!selected?.query?.id) return;
    try {
      setBusy(true);
      await fn();
      await openDetails(selected.query.id);
      await load();
      Alert.alert("Success", successMsg);
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || e?.message || "Action failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!selected?.query?.id || !reply.trim()) {
      return;
    }
    await act(
      () => staffService.replyQuery(selected.query.id, reply.trim()),
      "Reply sent",
    );
    setReply("");
  };

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
            Query Desk
          </Text>
          <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Acknowledge, reply, resolve, and close student queries.
          </Text>

          <View className="mt-4 gap-2">
            {queries.map((q) =>
              (() => {
                const imageURL = q.image_url?.trim() || "";
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => openDetails(q.id)}
                    className={`rounded-xl border px-4 py-3 dark:border-border-dark ${selected?.query?.id === q.id ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-bold text-card-foreground dark:text-card-foreground-dark">
                        {q.title}
                      </Text>
                      <Text className="text-xs font-bold uppercase text-muted-foreground dark:text-muted-foreground-dark">
                        {q.status}
                      </Text>
                    </View>
                    <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      #{q.id.slice(0, 8)}
                    </Text>
                    {imageURL ? (
                      <Image
                        source={{ uri: imageURL }}
                        className="mt-3 h-28 w-full rounded-lg"
                        resizeMode="cover"
                      />
                    ) : null}
                  </Pressable>
                );
              })(),
            )}
          </View>
        </View>

        {selected
          ? (() => {
              const detailImageURL = selected.query.image_url?.trim() || "";
              return (
                <View className="mt-6 rounded-3xl bg-card p-5 dark:bg-card-dark">
                  <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                    Selected Query
                  </Text>
                  <Text className="mt-2 text-lg font-bold text-card-foreground dark:text-card-foreground-dark">
                    {selected.query.title}
                  </Text>
                  <Text className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    {selected.query.description}
                  </Text>
                  {detailImageURL ? (
                    <Image
                      source={{ uri: detailImageURL }}
                      className="mt-4 h-52 w-full rounded-xl"
                      resizeMode="cover"
                    />
                  ) : null}
                  {detailImageURL ? (
                    <Pressable
                      onPress={() => Linking.openURL(detailImageURL)}
                      className="mt-2"
                    >
                      <Text className="text-xs text-primary dark:text-primary-dark">
                        Open image link
                      </Text>
                    </Pressable>
                  ) : (
                    <Text className="mt-3 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      No valid image URL on this query.
                    </Text>
                  )}

                  <View className="mt-4 flex-row flex-wrap gap-2">
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        act(
                          () =>
                            staffService.acknowledgeQuery(selected.query.id),
                          "Query acknowledged",
                        )
                      }
                      className="rounded-full border border-border px-4 py-2 dark:border-border-dark"
                    >
                      <Text className="font-semibold text-card-foreground dark:text-card-foreground-dark">
                        Acknowledge
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        act(
                          () => staffService.resolveQuery(selected.query.id),
                          "Query resolved",
                        )
                      }
                      className="rounded-full border border-border px-4 py-2 dark:border-border-dark"
                    >
                      <Text className="font-semibold text-card-foreground dark:text-card-foreground-dark">
                        Resolve
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        act(
                          () => staffService.closeQuery(selected.query.id),
                          "Query closed",
                        )
                      }
                      className="rounded-full border border-border px-4 py-2 dark:border-border-dark"
                    >
                      <Text className="font-semibold text-card-foreground dark:text-card-foreground-dark">
                        Close
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    placeholder="Write a response"
                    multiline
                    numberOfLines={3}
                    className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
                  />
                  <Pressable
                    disabled={busy || !reply.trim()}
                    onPress={sendReply}
                    className="mt-3 items-center rounded-full bg-primary-dark px-5 py-3 dark:bg-primary"
                  >
                    <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
                      Send Reply
                    </Text>
                  </Pressable>

                  <Text className="mt-5 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                    Replies
                  </Text>
                  <View className="mt-2 gap-2">
                    {(selected.replies || []).map((r) => (
                      <View
                        key={r.id}
                        className="rounded-xl border border-border p-3 dark:border-border-dark"
                      >
                        <Text className="text-sm text-card-foreground dark:text-card-foreground-dark">
                          {r.message}
                        </Text>
                      </View>
                    ))}
                    {(selected.replies || []).length === 0 ? (
                      <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                        No replies yet.
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })()
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
