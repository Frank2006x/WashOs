import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import QRScanner from "@/components/QRScanner";
import { MachineRecord, staffService } from "@/services/api";
import { useTranslation } from "react-i18next";

type StaffPhase =
  | "intake"
  | "wash_start"
  | "wash_finish"
  | "dry_start"
  | "dry_finish"
  | "ready";

const PHASES: { key: StaffPhase; label: string }[] = [
  { key: "intake", label: "Intake" },
  { key: "wash_start", label: "Wash Start" },
  { key: "wash_finish", label: "Wash Finish" },
  { key: "dry_start", label: "Dry Start" },
  { key: "dry_finish", label: "Dry Finish" },
  { key: "ready", label: "Ready" },
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
  const [phase, setPhase] = useState<StaffPhase>("intake");
  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const [selectedMachineID, setSelectedMachineID] = useState<string>("");
  const [rowNo, setRowNo] = useState("");
  const [lastResult, setLastResult] = useState<string>("");
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

      let bookingID = "";
      let status = "";
      let title = t("common.success", "Success");
      let message = "";

      if (phase === "intake") {
        const res = await staffService.intakeScan(qrCode);
        bookingID = res.booking?.booking_id || "";
        status = res.booking?.status || "";
        message = t(
          "staff.intake_success",
          "Bag intake recorded successfully.",
        );
      } else if (phase === "wash_start") {
        const res = await staffService.scanWashStart(qrCode, selectedMachineID);
        bookingID = res.booking?.id || "";
        status = res.booking?.status || "";
        message = "Wash started.";
      } else if (phase === "wash_finish") {
        const res = await staffService.scanWashFinish(
          qrCode,
          selectedMachineID,
        );
        bookingID = res.booking?.id || "";
        status = res.booking?.status || "";
        message = "Wash finished.";
      } else if (phase === "dry_start") {
        const res = await staffService.scanDryStart(qrCode, selectedMachineID);
        bookingID = res.booking?.id || "";
        status = res.booking?.status || "";
        message = "Dry started.";
      } else if (phase === "dry_finish") {
        const res = await staffService.scanDryFinish(qrCode, selectedMachineID);
        bookingID = res.booking?.id || "";
        status = res.booking?.status || "";
        message = "Dry finished.";
      } else {
        const res = await staffService.scanReady(qrCode, rowNo.trim());
        bookingID = res.booking?.id || "";
        status = res.booking?.status || "";
        message = "Marked ready for pickup.";
      }

      const resultParts = [];
      if (bookingID) resultParts.push(`#${String(bookingID).slice(0, 8)}`);
      if (status) resultParts.push(String(status));
      setLastResult(resultParts.join(" · "));

      Alert.alert(title, message);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        t("staff.intake_failed", "Failed to record bag intake.");
      Alert.alert(t("common.error", "Error"), msg);
    }
  };

  return (
    <View className="flex-1 bg-background px-4 py-4 dark:bg-background-dark">
      <Text className="mb-3 text-2xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
        Scan Center
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        <View className="flex-row gap-2">
          {PHASES.map((item) => {
            const active = item.key === phase;
            return (
              <Pressable
                key={item.key}
                onPress={() => setPhase(item.key)}
                className={`rounded-full px-4 py-2 ${
                  active
                    ? "bg-primary-dark dark:bg-primary"
                    : "bg-card dark:bg-card-dark"
                }`}
              >
                <Text
                  className={`font-bold ${
                    active
                      ? "text-primary-foreground-dark dark:text-primary-foreground"
                      : "text-card-foreground dark:text-card-foreground-dark"
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="mb-3 rounded-2xl bg-card p-4 dark:bg-card-dark">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
          Phase Rule
        </Text>
        <Text className="mt-2 text-sm font-semibold text-card-foreground dark:text-card-foreground-dark">
          Expected status: {hint.expectedStatus}
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {hint.action}
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
          {hint.note}
        </Text>
      </View>

      {requiresMachine ? (
        <View className="mb-3 rounded-2xl bg-card p-4 dark:bg-card-dark">
          <Text className="mb-2 text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
            Select {machineType} machine
          </Text>

          {machineLoading ? (
            <ActivityIndicator size="small" />
          ) : machines.length === 0 ? (
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              No {machineType} machines available.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {machines.map((machine) => {
                const active = selectedMachineID === machine.id;
                return (
                  <Pressable
                    key={machine.id}
                    onPress={() => setSelectedMachineID(machine.id)}
                    className={`rounded-full border px-3 py-2 ${
                      active
                        ? "border-primary-dark bg-primary-dark/10 dark:border-primary dark:bg-primary/10"
                        : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                    }`}
                  >
                    <Text className="font-semibold text-card-foreground dark:text-card-foreground-dark">
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
        <View className="mb-3 rounded-2xl bg-card p-4 dark:bg-card-dark">
          <Text className="mb-2 text-sm font-bold text-card-foreground dark:text-card-foreground-dark">
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

      {canScan ? (
        <View className="flex-1 overflow-hidden rounded-2xl">
          <QRScanner
            title={`${phase.replaceAll("_", " ")} scan`}
            onScan={handleScan}
          />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center rounded-2xl bg-card p-6 dark:bg-card-dark">
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            {requiresMachine
              ? "Select a machine to enable scanning."
              : "Enter shelf/row to enable scanning."}
          </Text>
        </View>
      )}

      {lastResult ? (
        <View className="mt-3 rounded-xl border border-border bg-card px-4 py-3 dark:border-border-dark dark:bg-card-dark">
          <Text className="text-sm font-medium text-card-foreground dark:text-card-foreground-dark">
            Last result: {lastResult}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
