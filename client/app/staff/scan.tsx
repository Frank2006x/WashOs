import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import QRScanner from "@/components/QRScanner";
import { MachineRecord, staffService } from "@/services/api";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type StaffPhase =
  | "intake"
  | "wash_start"
  | "wash_finish"
  | "dry_start"
  | "dry_finish"
  | "ready";

const PHASES: { key: StaffPhase; label: string; icon: any }[] = [
  { key: "intake", label: "Intake", icon: "inbox-arrow-down" },
  { key: "wash_start", label: "Wash Start", icon: "washing-machine" },
  { key: "wash_finish", label: "Wash Finish", icon: "washing-machine-off" },
  { key: "dry_start", label: "Dry Start", icon: "tumble-dryer" },
  { key: "dry_finish", label: "Dry Finish", icon: "tumble-dryer-off" },
  { key: "ready", label: "Ready", icon: "check-circle-outline" },
];

const PHASE_HINTS: Record<
  StaffPhase,
  { expectedStatus: string; action: string; note: string }
> = {
  intake: {
    expectedStatus: "No active booking for bag",
    action: "Scan student bag QR to create and drop off booking.",
    note: "First phase only.",
  },
  wash_start: {
    expectedStatus: "dropped_off",
    action: "Select washer machine then scan bag QR.",
    note: "Starts wash run and marks booking as washing.",
  },
  wash_finish: {
    expectedStatus: "washing",
    action: "Select same washer machine then scan bag QR.",
    note: "Finishes wash run and marks booking as wash_done.",
  },
  dry_start: {
    expectedStatus: "wash_done",
    action: "Select dryer machine then scan bag QR.",
    note: "Starts dry run and marks booking as drying.",
  },
  dry_finish: {
    expectedStatus: "drying",
    action: "Select same dryer machine then scan bag QR.",
    note: "Finishes dry run and marks booking as dry_done.",
  },
  ready: {
    expectedStatus: "dry_done",
    action: "Enter shelf/row and scan bag QR.",
    note: "Marks booking ready_for_pickup and notifies student.",
  },
};

export default function StaffIntakeScanScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { phase: initialPhase } = useLocalSearchParams<{ phase?: string }>();
  const isCompact = width < 360;
  
  const [phase, setPhase] = useState<StaffPhase>(
    (initialPhase as StaffPhase) || "intake"
  );

  useEffect(() => {
    if (initialPhase) {
      setPhase(initialPhase as StaffPhase);
    }
  }, [initialPhase]);

  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const [selectedMachineID, setSelectedMachineID] = useState<string>("");
  const [rowNo, setRowNo] = useState("");
  const [lastScanStatus, setLastScanStatus] = useState<
    "success" | "error" | null
  >(null);
  const [lastScanMessage, setLastScanMessage] = useState<string>("");
  const hint = PHASE_HINTS[phase];

  const machineType = useMemo(() => {
    if (phase === "wash_start" || phase === "wash_finish") return "washer";
    if (phase === "dry_start" || phase === "dry_finish") return "dryer";
    return null;
  }, [phase]);

  const requiresMachine = machineType !== null;
  const requiresRow = phase === "ready";
  const canScan =
    (!requiresMachine || !!selectedMachineID) &&
    (!requiresRow || rowNo.trim().length > 0);

  useEffect(() => {
    if (!machineType) {
      setMachines([]);
      setSelectedMachineID("");
      return;
    }

    (async () => {
      try {
        setMachineLoading(true);
        const res = await staffService.listMachines(machineType);
        setMachines(res.machines || []);
        setSelectedMachineID("");
      } catch (e: any) {
        setMachines([]);
        Alert.alert(
          t("common.error", "Error"),
          e?.response?.data?.error ||
            e?.message ||
            t("staff.machine_load_failed", "Failed to load machine list."),
        );
      } finally {
        setMachineLoading(false);
      }
    })();
  }, [machineType, t]);

  const handleScan = async (data: any) => {
    if (!canScan) return;

    try {
      const qrCode = typeof data === "string" ? data : JSON.stringify(data);

      let title = t("common.success", "Success");
      let message = "";

      if (phase === "intake") {
        await staffService.intakeScan(qrCode);
        message = t(
          "staff.intake_success",
          "Bag intake recorded successfully.",
        );
      } else if (phase === "wash_start") {
        await staffService.scanWashStart(qrCode, selectedMachineID);
        message = "Wash started.";
      } else if (phase === "wash_finish") {
        await staffService.scanWashFinish(qrCode, selectedMachineID);
        message = "Wash finished.";
      } else if (phase === "dry_start") {
        await staffService.scanDryStart(qrCode, selectedMachineID);
        message = "Dry started.";
      } else if (phase === "dry_finish") {
        await staffService.scanDryFinish(qrCode, selectedMachineID);
        message = "Dry finished.";
      } else {
        await staffService.scanReady(qrCode, rowNo.trim());
        message = "Marked ready for pickup.";
      }

      setLastScanStatus("success");
      setLastScanMessage(message);

      Alert.alert(title, message);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        t("staff.intake_failed", "Failed to record bag intake.");
      setLastScanStatus("error");
      setLastScanMessage(msg);
      Alert.alert(t("common.error", "Error"), msg);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-background-dark"
      edges={["top"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName={
          isCompact ? "px-3 py-4 pb-16" : "px-4 py-5 pb-20"
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          className={`rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
          <Text
            className={`${isCompact ? "text-2xl" : "text-3xl"} font-extrabold text-card-foreground dark:text-card-foreground-dark`}
          >
            Scan Center
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            Choose phase, complete required inputs, then scan bag QR.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16 }}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            {PHASES.map((item) => {
              const active = item.key === phase;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setPhase(item.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 9999,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderWidth: 1,
                    backgroundColor: active ? (isCompact ? "#3A52C6" : "#4194d7") : "transparent",
                    borderColor: active ? (isCompact ? "#3A52C6" : "#4194d7") : "#2A2D3E",
                  }}
                >
                  <MaterialCommunityIcons 
                    name={item.icon} 
                    size={16} 
                    color={active ? "white" : "#a1a1aa"} 
                  />
                  <Text
                    style={{
                      fontWeight: "800",
                      color: active ? "white" : "#F0F2FF",
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View
          className={`mt-4 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
            Phase Rule
          </Text>
          <Text
            className={`${isCompact ? "mt-2 text-xs" : "mt-3 text-sm"} font-semibold text-card-foreground dark:text-card-foreground-dark`}
          >
            Expected status: {hint.expectedStatus}
          </Text>
          <Text
            className={`mt-2 ${isCompact ? "text-xs leading-5" : "text-sm leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
          >
            {hint.action}
          </Text>
          <Text className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
            {hint.note}
          </Text>
        </View>

        {requiresMachine ? (
          <View
            className={`mt-4 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text
              className={`${isCompact ? "text-xs" : "text-sm"} font-bold text-card-foreground dark:text-card-foreground-dark`}
            >
              Select {machineType} machine
            </Text>

            {machineLoading ? (
              <View className="mt-3">
                <ActivityIndicator size="small" />
              </View>
            ) : machines.length === 0 ? (
              <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                No {machineType} machines available.
              </Text>
            ) : (
              <View
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: isCompact ? 8 : 12,
                }}
              >
                {machines.map((machine) => {
                  const active = selectedMachineID === machine.id;
                  return (
                    <Pressable
                      key={machine.id}
                      onPress={() => setSelectedMachineID(machine.id)}
                      style={{
                        borderRadius: 16,
                        borderWidth: 1,
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        minWidth: 80,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? "rgba(65, 148, 215, 0.15)" : "transparent",
                        borderColor: active ? "#4194d7" : "#2A2D3E",
                      }}
                    >
                      <MaterialCommunityIcons 
                        name={machineType === "washer" ? "washing-machine" : "tumble-dryer"} 
                        size={28} 
                        color={active ? "#4194d7" : "#a1a1aa"} 
                      />
                      <Text 
                        style={{
                          fontWeight: "700",
                          marginTop: 8,
                          fontSize: 14,
                          color: active ? "#4194d7" : "#F0F2FF",
                        }}
                      >
                        {machine.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {requiresRow ? (
          <View
            className={`mt-4 rounded-3xl bg-card dark:bg-card-dark ${isCompact ? "p-4" : "p-5"}`}
          >
            <Text
              className={`mb-2 ${isCompact ? "text-xs" : "text-sm"} font-bold text-card-foreground dark:text-card-foreground-dark`}
            >
              Enter shelf/row
            </Text>
            <TextInput
              value={rowNo}
              onChangeText={setRowNo}
              placeholder="R12"
              className="rounded-xl border border-border bg-background px-4 py-3 text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
            />
          </View>
        ) : null}

        <View
          className={`mt-4 ${isCompact ? "min-h-[330px]" : "min-h-[380px]"} overflow-hidden rounded-3xl border-2 ${
            canScan ? "border-primary-dark/30 dark:border-primary/30 shadow-sm" : "border-transparent"
          }`}
        >
          {canScan ? (
            <QRScanner
              title={`Awaiting ${phase.replaceAll("_", " ")} scan...`}
              onScan={handleScan}
              showScanDetails={false}
            />
          ) : (
            <View className="flex-1 items-center justify-center rounded-3xl bg-card p-6 dark:bg-card-dark border border-border dark:border-border-dark">
              <MaterialCommunityIcons 
                name="qrcode-scan" 
                size={48} 
                color="#83827d" 
                style={{ opacity: 0.5, marginBottom: 16 }}
              />
              <Text
                className={`max-w-[220px] text-center font-semibold ${isCompact ? "text-sm leading-5" : "text-base leading-6"} text-muted-foreground dark:text-muted-foreground-dark`}
              >
                {requiresMachine
                  ? "Select a machine first to unlock scanner"
                  : "Enter shelf/row first to unlock scanner"}
              </Text>
            </View>
          )}
        </View>

        {lastScanStatus ? (
          <View
            className={`mt-4 rounded-2xl border px-4 py-3 ${
              lastScanStatus === "success"
                ? "border-green-500/60 bg-green-500/10"
                : "border-red-500/60 bg-red-500/10"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                lastScanStatus === "success" ? "text-green-200" : "text-red-200"
              }`}
            >
              {lastScanStatus === "success" ? "Scan successful" : "Scan failed"}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
              {lastScanMessage}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
