import Constants from "expo-constants";
import { Platform } from "react-native";
import type { NotificationRecord } from "@/services/api";

let isInitialized = false;
const knownUnreadIDs = new Set<string>();
let notificationsModulePromise: Promise<
  typeof import("expo-notifications") | null
> | null = null;

function isExpoGoRuntime(): boolean {
  const maybeExecutionEnvironment = (Constants as any)?.executionEnvironment;
  return (
    Constants.appOwnership === "expo" ||
    maybeExecutionEnvironment === "storeClient"
  );
}

async function getNotificationsModule(): Promise<
  typeof import("expo-notifications") | null
> {
  if (Platform.OS === "web" || isExpoGoRuntime()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then((Notifications) => {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        return Notifications;
      })
      .catch(() => null);
  }

  return notificationsModulePromise;
}

function normalizeID(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("washos-default", {
      name: "WashOs Alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4194d7",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (
    existing.granted ||
    existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return Boolean(
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  );
}

export function getNotificationPlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  try {
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return res?.data || null;
  } catch {
    return null;
  }
}

export function primeUnreadNotifications(items: NotificationRecord[]): void {
  knownUnreadIDs.clear();
  for (const item of items) {
    if (!item?.is_read) {
      const id = normalizeID(item.id);
      if (id) {
        knownUnreadIDs.add(id);
      }
    }
  }
  isInitialized = true;
}

export async function notifyForNewUnread(
  items: NotificationRecord[],
): Promise<number> {
  const Notifications = await getNotificationsModule();

  const unread = items.filter((it) => !it?.is_read);

  if (!isInitialized) {
    primeUnreadNotifications(unread);
    return 0;
  }

  if (!Notifications) {
    const latestUnreadIDs = new Set(
      unread.map((it) => normalizeID(it.id)).filter(Boolean),
    );
    for (const id of Array.from(knownUnreadIDs.values())) {
      if (!latestUnreadIDs.has(id)) {
        knownUnreadIDs.delete(id);
      }
    }
    return 0;
  }

  let newCount = 0;
  for (const item of unread) {
    const id = normalizeID(item.id);
    if (!id || knownUnreadIDs.has(id)) {
      continue;
    }

    knownUnreadIDs.add(id);
    newCount += 1;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title || "WashOs Update",
        body: item.message || "You have a new laundry update.",
        data: {
          notification_id: id,
          booking_id:
            typeof item.payload === "object" && item.payload
              ? (item.payload as Record<string, unknown>).booking_id
              : undefined,
        },
      },
      trigger: null,
    });
  }

  const latestUnreadIDs = new Set(
    unread.map((it) => normalizeID(it.id)).filter(Boolean),
  );
  for (const id of Array.from(knownUnreadIDs.values())) {
    if (!latestUnreadIDs.has(id)) {
      knownUnreadIDs.delete(id);
    }
  }

  return newCount;
}
