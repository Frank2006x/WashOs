import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QRScannerProps {
  /** Title displayed at the top of the scanner (e.g. "Drop-off Scan") */
  title: string;
  /** Callback fired with parsed data (or raw string if not JSON) after a scan */
  onScan?: (data: any) => void;
  /** When false, hides raw/parsed payload details and only shows scan status. */
  showScanDetails?: boolean;
  /**
   * When true (default), scanning is disabled after the first successful scan
   * until the user taps "Scan Again".
   */
  singleScan?: boolean;
}

type ScanState = "loading" | "denied" | "scanning" | "success" | "error";

// ─── Component ───────────────────────────────────────────────────────────────

const QRScanner: React.FC<QRScannerProps> = ({
  title,
  onScan,
  showScanDetails = true,
  singleScan = true,
}) => {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanState, setScanState] = useState<ScanState>(
    permission === null
      ? "loading"
      : permission?.granted
        ? "scanning"
        : "denied",
  );
  const [scannedData, setScannedData] = useState<any>(null);
  const [rawValue, setRawValue] = useState<string>("");
  const [parseError, setParseError] = useState(false);

  const hasScanned = useRef(false);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // ── Permission sync ──────────────────────────────────────────────
  React.useEffect(() => {
    if (permission === null) {
      setScanState("loading");
      return;
    }
    if (permission.granted) {
      setScanState("scanning");
    } else {
      setScanState("denied");
    }
  }, [permission]);

  // ── Flash animation on scan success ─────────────────────────────────────
  const triggerFlash = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [flashAnim]);

  // ── Barcode handler ─────────────────────────────────────────────────────
  const handleBarCodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (singleScan && hasScanned.current) return;
      hasScanned.current = true;

      setRawValue(data);

      // Vibrate on success
      Vibration.vibrate(200);
      triggerFlash();

      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = data;
      }

      setScannedData(parsed);
      setParseError(false);
      setScanState("success");

      onScan?.(parsed);
    },
    [singleScan, onScan, triggerFlash],
  );

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleScanAgain = useCallback(() => {
    hasScanned.current = false;
    setScannedData(null);
    setRawValue("");
    setParseError(false);
    flashAnim.setValue(0); // Reset the flash opacity curtain!
    setScanState("scanning");
  }, [flashAnim]);

  // ─── Render: Loading ─────────────────────────────────────────────────────
  if (scanState === "loading" || permission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>
          {t("scanner.requesting_permission")}
        </Text>
      </View>
    );
  }

  // ─── Render: Permission Denied ───────────────────────────────────────────
  if (scanState === "denied") {
    return (
      <View style={styles.centered}>
        <Text style={styles.icon}>🚫</Text>
        <Text style={styles.deniedTitle}>{t("scanner.camera_denied")}</Text>
        <Text style={styles.deniedBody}>{t("scanner.enable_camera_desc")}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            requestPermission().then((r: any) =>
              setScanState(r.granted ? "scanning" : "denied"),
            )
          }
        >
          <Text style={styles.primaryButtonText}>
            {t("scanner.grant_permission")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: Scanning / Success / Error ──────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>
          {scanState === "scanning"
            ? t("scanner.point_to_scan")
            : parseError
              ? t("scanner.invalid_format")
              : t("scanner.scan_complete")}
        </Text>
      </View>

      {/* Camera / Result area */}
      {scanState === "scanning" ? (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          {/* Scan overlay */}
          <View style={[styles.overlay, StyleSheet.absoluteFill]}>
            <View style={styles.scanFrame}>
              {/* Corner accents */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.overlayHint}>{t("scanner.align_qr")}</Text>
          </View>

          {/* Flash success overlay */}
          <Animated.View
            pointerEvents="none"
            style={[styles.flashOverlay, { opacity: flashAnim }]}
          />
        </View>
      ) : (
        /* Result card */
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={styles.resultScrollContent}
        >
          {/* Status badge */}
          <View
            style={[
              styles.statusBadge,
              parseError ? styles.statusBadgeError : styles.statusBadgeSuccess,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {parseError
                ? t("scanner.invalid_format_badge")
                : t("scanner.scan_success_badge")}
            </Text>
          </View>

          {showScanDetails ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>{t("scanner.raw_value")}</Text>
                <Text style={styles.cardRaw} selectable>
                  {rawValue}
                </Text>
              </View>

              {!parseError && scannedData !== null ? (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>
                    {t("scanner.parsed_json")}
                  </Text>
                  {renderParsedData(scannedData, 0, t)}
                </View>
              ) : null}

              {parseError ? (
                <View style={[styles.card, styles.cardError]}>
                  <Text style={styles.cardErrorText}>
                    {t("scanner.invalid_json_data")}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t("scanner.status")}</Text>
              <Text style={styles.valuePrimitive}>
                {parseError
                  ? t("scanner.scan_failed_retry")
                  : t("scanner.scan_processed")}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Scan Again button */}
      {scanState !== "scanning" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleScanAgain}
          >
            <Text style={styles.primaryButtonText}>
              {t("scanner.scan_again")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively renders parsed JSON as key-value rows.
 */
function renderParsedData(data: any, depth = 0, t: any): React.ReactNode {
  if (data === null || data === undefined) {
    return <Text style={styles.valueNull}>{t("scanner.null_value")}</Text>;
  }
  if (typeof data !== "object") {
    return <Text style={styles.valuePrimitive}>{String(data)}</Text>;
  }
  if (Array.isArray(data)) {
    return (
      <View style={{ marginLeft: depth * 8 }}>
        {data.map((item, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowKey}>[{i}]</Text>
            <View style={styles.rowValue}>
              {renderParsedData(item, depth + 1, t)}
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ marginLeft: depth * 8 }}>
      {Object.entries(data).map(([key, value]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.rowKey}>{key}</Text>
          <View style={styles.rowValue}>
            {renderParsedData(value, depth + 1, t)}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const colors = {
  primary: "#4F6BED",
  primaryDark: "#3A52C6",
  success: "#22C55E",
  error: "#EF4444",
  bg: "#0F1117",
  surface: "#1A1D27",
  border: "#2A2D3E",
  text: "#F0F2FF",
  textMuted: "#8B8FA8",
  white: "#FFFFFF",
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Camera
  cameraWrapper: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: colors.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  overlayHint: {
    marginTop: 24,
    color: colors.white,
    fontSize: 13,
    opacity: 0.8,
    letterSpacing: 0.3,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success,
  },

  // Result
  resultScroll: {
    flex: 1,
  },
  resultScrollContent: {
    padding: 20,
    gap: 14,
  },
  statusBadge: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  statusBadgeSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: colors.success,
  },
  statusBadgeError: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: colors.error,
  },
  statusBadgeText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 14,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardError: {
    borderColor: "rgba(239,68,68,0.4)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 10,
  },
  cardRaw: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  cardErrorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 20,
  },

  // Parsed JSON rows
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowKey: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    width: 110,
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
  },
  valuePrimitive: {
    fontSize: 13,
    color: colors.text,
  },
  valueNull: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
  },

  // Footer
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // Permission denied
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
    textAlign: "center",
  },
  deniedBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  statusText: {
    marginTop: 16,
    color: colors.textMuted,
    fontSize: 14,
  },
});

export default QRScanner;
