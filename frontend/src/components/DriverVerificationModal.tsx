import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type DriverInfo = {
  id: string;
  full_name: string;
  phone?: string;
  badge_photo?: string;
  license_number: string;
  vehicle_plate: string;
  years_driving: number;
  verified: boolean;
  verified_by: string;
  average_rating: number;
  total_ratings: number;
  completed_trips: number;
};

export function DriverVerificationModal({
  visible,
  driverId,
  onClose,
}: {
  visible: boolean;
  driverId: string | null;
  onClose: () => void;
}) {
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !driverId) return;
    setLoading(true);
    api.get<DriverInfo>(`/driver-info/${driverId}`)
      .then(setDriver)
      .catch(() => setDriver(null))
      .finally(() => setLoading(false));
  }, [visible, driverId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Driver Verification</Text>
            <TouchableOpacity onPress={onClose} testID="close-driver-modal">
              <Ionicons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {loading || !driver ? (
            <View style={{ padding: 40 }}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
              <View style={styles.avatarBox}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={48} color={COLORS.primary} />
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>

              <Text style={styles.driverName}>{driver.full_name}</Text>
              <Text style={styles.verifiedBy}>Verified by {driver.verified_by}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{driver.average_rating || "—"}</Text>
                  <Text style={styles.statLabel}>★ Rating</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{driver.completed_trips}</Text>
                  <Text style={styles.statLabel}>Trips</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{driver.years_driving}y</Text>
                  <Text style={styles.statLabel}>Driving</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="id-card" size={18} color={COLORS.textSecondary} />
                  <Text style={styles.infoLabel}>License</Text>
                  <Text style={styles.infoValue}>{driver.license_number}</Text>
                </View>
                {driver.vehicle_plate ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="bus" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.infoLabel}>Vehicle</Text>
                    <Text style={styles.infoValue}>{driver.vehicle_plate}</Text>
                  </View>
                ) : null}
                {driver.phone ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="call" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.infoLabel}>Contact</Text>
                    <Text style={styles.infoValue}>{driver.phone}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15, 27, 61, 0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  avatarBox: { alignItems: "center", marginBottom: SPACING.md, position: "relative" },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    position: "absolute",
    bottom: -8,
    right: "35%",
  },
  verifiedText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 },
  driverName: { fontSize: 22, fontWeight: "800", color: COLORS.primary, textAlign: "center", marginTop: SPACING.md },
  verifiedBy: { fontSize: 12, color: COLORS.textSecondary, textAlign: "center", marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: SPACING.lg, marginBottom: SPACING.md },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "600" },
  infoCard: {
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary, marginLeft: SPACING.sm, fontWeight: "600" },
  infoValue: { fontSize: 13, color: COLORS.primary, fontWeight: "700" },
});
