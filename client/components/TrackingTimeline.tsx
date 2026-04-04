import React, { useEffect } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type TrackingStatus =
  | "created"
  | "dropped_off"
  | "washing"
  | "wash_done"
  | "drying"
  | "dry_done"
  | "ready_for_pickup"
  | "collected";

type TrackingStep = {
  id: string;
  title: string;
  statuses: TrackingStatus[];
  eventTypes: string[];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const TRACKING_STEPS: TrackingStep[] = [
  {
    id: "intake",
    title: "Order Placed",
    statuses: ["created", "dropped_off"],
    eventTypes: ["received"],
    icon: "text-box-check-outline",
  },
  {
    id: "washing",
    title: "Washing",
    statuses: ["washing", "wash_done"],
    eventTypes: ["wash_started", "wash_finished"],
    icon: "washing-machine",
  },
  {
    id: "drying",
    title: "Drying",
    statuses: ["drying", "dry_done"],
    eventTypes: ["dry_started", "dry_finished"],
    icon: "tumble-dryer",
  },
  {
    id: "ready",
    title: "Ready",
    statuses: ["ready_for_pickup"],
    eventTypes: ["marked_ready"],
    icon: "bag-checked",
  },
  {
    id: "collected",
    title: "Collected",
    statuses: ["collected"],
    eventTypes: ["collected"],
    icon: "check-circle",
  },
];

export function getActiveStepIndex(status: string): number {
  const st = status as TrackingStatus;
  const index = TRACKING_STEPS.findIndex((step) => step.statuses.includes(st));
  return index !== -1 ? index : 0;
}

interface TrackingTimelineProps {
  currentStatus: string;
  orientation?: "horizontal" | "vertical";
  showDetails?: boolean; // If true, shows times/machines per step
  events?: Record<string, any>[]; // The event history mapping tracking states
}

export default function TrackingTimeline({
  currentStatus,
  orientation = "horizontal",
  showDetails = false,
  events = [],
}: TrackingTimelineProps) {
  const activeIndex = getActiveStepIndex(currentStatus);
  const isHorizontal = orientation === "horizontal";
  const { width } = useWindowDimensions();

  // Extract time and event detail by scanning matching events
  const getStepData = (eventTypes: string[]) => {
    const sorted = [...events].sort((a, b) => {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    const stepEvents = sorted.filter((e) => eventTypes.includes(e.event_type));

    if (stepEvents.length === 0) return null;

    const latestEvent = stepEvents[0];
    let timeLabel = "";
    if (latestEvent.created_at) {
      timeLabel = new Date(latestEvent.created_at).toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      });
    }

    let detailLabel = "";
    for (const evt of stepEvents) {
      let payload = evt.metadata;
      let parsedMetadata: any = {};
      if (typeof payload === "object" && payload !== null) {
        parsedMetadata = payload;
      } else if (typeof payload === "string") {
        try {
          parsedMetadata = JSON.parse(payload);
        } catch (e) {
          parsedMetadata = {};
        }
      }
      if (parsedMetadata?.machine_code) {
        detailLabel = `Machine: ${parsedMetadata.machine_code}`;
        break;
      }
      if (parsedMetadata?.row_no) {
        detailLabel = `Row: ${parsedMetadata.row_no}`;
        break;
      }
    }
    return { timeLabel, detailLabel };
  };

  return (
    <View
      className={`w-full ${
        isHorizontal ? "flex-row justify-between items-start" : "flex-col"
      }`}
    >
      {TRACKING_STEPS.map((step, index) => {
        const isActive = index === activeIndex;
        const isCompleted = index < activeIndex;
        const isPending = index > activeIndex;

        let iconColor = isPending
          ? "#a1a1aa"
          : isActive
            ? "#3b82f6"
            : "#22c55e"; // zinc-400, blue-500, green-500
        let iconBg = isPending
          ? "bg-muted dark:bg-muted-dark"
          : isActive
            ? "bg-blue-100 dark:bg-blue-900/40"
            : "bg-green-100 dark:bg-green-900/40";
        let titleColor = isPending
          ? "text-muted-foreground dark:text-muted-foreground-dark"
          : isActive
            ? "text-blue-600 dark:text-blue-400"
            : "text-green-600 dark:text-green-400";

        const stepData = showDetails ? getStepData(step.eventTypes) : null;
        let timeLabel = stepData?.timeLabel || "";
        let detailLabel = stepData?.detailLabel || "";

        return (
          <View
            key={step.id}
            className={`${
              isHorizontal ? "items-center flex-1" : "flex-row flex-1"
            }`}
          >
            {/* Horizontal Line Connector */}
            {isHorizontal && index < TRACKING_STEPS.length - 1 && (
              <View className="absolute top-5 left-[50%] w-full h-[2px] z-[-1] overflow-hidden">
                <View
                  className={`h-full w-full ${isCompleted ? "bg-green-500" : "bg-border dark:bg-border-dark border-dotted"}`}
                />
              </View>
            )}

            {/* Icon Bubble */}
            <View className={`${isHorizontal ? "" : "items-center mr-4"}`}>
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${iconBg}`}
              >
                <MaterialCommunityIcons
                  name={step.icon}
                  size={20}
                  color={iconColor}
                />
              </View>
              {/* Vertical Line Connector */}
              {!isHorizontal && index < TRACKING_STEPS.length - 1 && (
                <View
                  className={`w-[2px] flex-1 my-1 ${
                    isCompleted
                      ? "bg-green-500"
                      : "bg-border dark:bg-border-dark"
                  }`}
                  style={{ minHeight: showDetails ? 40 : 20 }}
                />
              )}
            </View>

            {/* Content Label */}
            <View
              className={`${
                isHorizontal ? "mt-2 items-center" : "flex-1 pb-6"
              }`}
            >
              <Text
                className={`text-xs font-bold ${isHorizontal ? "text-center" : "text-left"} ${titleColor}`}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {step.title}
              </Text>
              {showDetails && (timeLabel || detailLabel) ? (
                <View
                  className={`mt-1 ${isHorizontal ? "items-center" : "items-start"}`}
                >
                  {timeLabel ? (
                    <Text className="text-[11px] text-muted-foreground dark:text-muted-foreground-dark">
                      {timeLabel}
                    </Text>
                  ) : null}
                  {detailLabel ? (
                    <Text className="text-[11px] font-semibold text-foreground dark:text-foreground-dark mt-0.5">
                      {detailLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
