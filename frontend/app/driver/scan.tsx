import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Trip = { id: string; route_name: string };

type ScanResult = { ok: boolean; student: { id: string; name: string; avatar_url?: string; grade?: string } };

export default function DriverScan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [action, setAction] = useState<"board" | "checkout">("board");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(Platform.OS === "web");
  const scannedRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const trips = await api.get<Trip[]>("/trips/active");
      setTrip(trips[0] || null);
    })();
  }, []);

  const handleCode = async (code: string) => {
    if (loading || !trip) return;
    if (scannedRef.current === code) return;
    scannedRef.current = code;
    setLoading(true);
    try {
      const res = await api.post<ScanResult>(`/trips/${trip.id}/scan`, {
        qr_code: code,
        action,
      });
      setLastResult(res);
      // Reset after 2.5s
      setTimeout(() => {
        scannedRef.current = null;
      }, 2500);
    } catch (e: any) {
      Alert.alert("Scan failed", e.message || "Try again");
      scannedRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.empty}>
          <Ionicons name="qr-code-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No active route</Text>
          <Text style={styles.emptySub}>Start a route from the Home tab to begin scanning</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted && Platform.OS !== "web") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]} testID="permission-screen">
        <View style={styles.permission}>
          <View style={styles.iconBoxLg}>
            <Ionicons name="camera" size={42} color={COLORS.primary} />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>
            TripZen needs the camera to scan student QR badges for safe boarding.
          </Text>
          <TouchableOpacity
            testID="grant-camera-btn"
            style={styles.permBtn}
            onPress={requestPermission}
          >
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-scan-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Scan Child</Text>
        <Text style={styles.subtitle}>{trip.route_name}</Text>
      </View>

      {/* Action toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          testID="action-board"
          style={[styles.toggleBtn, action === "board" && styles.toggleActive]}
          onPress={() => setAction("board")}
        >
          <Ionicons name="enter" size={16} color={action === "board" ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.toggleText, action === "board" && { color: COLORS.primary, fontWeight: "800" }]}>
            Board
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="action-checkout"
          style={[styles.toggleBtn, action === "checkout" && styles.toggleActive]}
          onPress={() => setAction("checkout")}
        >
          <Ionicons
            name="exit"
            size={16}
            color={action === "checkout" ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={[styles.toggleText, action === "checkout" && { color: COLORS.primary, fontWeight: "800" }]}>
            Check Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera / Web fallback */}
      {Platform.OS !== "web" && !showManual ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => handleCode(data)}
          />
          <View style={styles.scanFrame} pointerEvents="none" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.manualBox}
        >
          <View style={styles.manualInner}>
            <Ionicons name="qr-code" size={64} color={COLORS.primary} />
            <Text style={styles.manualTitle}>Enter QR code manually</Text>
            <Text style={styles.manualSub}>
              Camera scanning isn't available on web preview. Use the test code below.
            </Text>
            <TextInput
              testID="manual-qr-input"
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="TRIPZEN-XXXXXXXX"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              testID="manual-scan-btn"
              style={styles.manualBtn}
              onPress={() => {
                if (manualCode) {
                  handleCode(manualCode);
                  setManualCode("");
                }
              }}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.manualBtnText}>Submit Code</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {Platform.OS !== "web" && (
        <TouchableOpacity
          testID="toggle-manual-btn"
          style={styles.linkBtn}
          onPress={() => setShowManual((v) => !v)}
        >
          <Text style={styles.linkText}>
            {showManual ? "Use camera instead" : "Enter code manually"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Result */}
      {lastResult && (
        <View style={styles.resultCard} testID="scan-result">
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
          </View>
          {lastResult.student.avatar_url && (
            <Image source={{ uri: lastResult.student.avatar_url }} style={styles.resultAvatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName}>{lastResult.student.name}</Text>
            <Text style={styles.resultMeta}>
              {action === "board" ? "Boarded at" : "Checked out at"} {new Date().toLocaleTimeString()}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  toggleActive: { backgroundColor: COLORS.accentLight },
  toggleText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },
  cameraBox: {
    marginHorizontal: SPACING.lg,
    height: 360,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  scanFrame: {
    position: "absolute",
    top: 60,
    left: 60,
    right: 60,
    bottom: 60,
    borderWidth: 3,
    borderColor: COLORS.accent,
    borderRadius: 18,
  },
  manualBox: { flex: 0, paddingHorizontal: SPACING.lg },
  manualInner: {
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  manualTitle: { fontSize: 16, fontWeight: "800", color: COLORS.primary, marginTop: SPACING.md },
  manualSub: { fontSize: 12, color: COLORS.textSecondary, textAlign: "center", marginTop: 6, marginBottom: SPACING.md },
  manualInput: {
    width: "100%",
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    textAlign: "center",
    letterSpacing: 1,
  },
  manualBtn: {
    width: "100%",
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  manualBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
  linkBtn: { alignItems: "center", marginTop: SPACING.md },
  linkText: { color: COLORS.textSecondary, fontSize: 13, textDecorationLine: "underline" },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.successBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  resultIcon: { marginRight: SPACING.md },
  resultAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md, backgroundColor: COLORS.bg },
  resultName: { fontSize: 15, fontWeight: "800", color: COLORS.primary },
  resultMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  permission: { flex: 1, padding: SPACING.lg, alignItems: "center", justifyContent: "center" },
  iconBoxLg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  permTitle: { fontSize: 20, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  permSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", marginTop: 8, marginBottom: SPACING.lg },
  permBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  permBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginTop: SPACING.md },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textAlign: "center" },
});
