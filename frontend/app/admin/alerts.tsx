import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Alert = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
};

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await api.get<Alert[]>("/admin/alerts");
      setAlerts(a);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-alerts-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <Text style={styles.subtitle}>System notifications & incidents</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
        ) : alerts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark" size={42} color={COLORS.success} />
            <Text style={styles.emptyText}>All clear</Text>
            <Text style={styles.emptySub}>No incidents to report</Text>
          </View>
        ) : (
          alerts.map((a) => (
            <View key={a.id} style={styles.card} testID={`alert-row-${a.id}`}>
              <View
                style={[
                  styles.iconBox,
                  a.severity === "critical"
                    ? { backgroundColor: COLORS.errorBg }
                    : a.severity === "warning"
                      ? { backgroundColor: COLORS.warningBg }
                      : { backgroundColor: COLORS.bgTertiary },
                ]}
              >
                <Ionicons
                  name={
                    a.severity === "critical"
                      ? "alert-circle"
                      : a.severity === "warning"
                        ? "warning"
                        : "information-circle"
                  }
                  size={20}
                  color={
                    a.severity === "critical"
                      ? COLORS.error
                      : a.severity === "warning"
                        ? COLORS.warning
                        : COLORS.textSecondary
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.alertTitle}>{a.title}</Text>
                  <Text style={styles.time}>
                    {new Date(a.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <Text style={styles.msg}>{a.message}</Text>
                <View
                  style={[
                    styles.sevChip,
                    a.severity === "critical"
                      ? { backgroundColor: COLORS.errorBg }
                      : a.severity === "warning"
                        ? { backgroundColor: COLORS.warningBg }
                        : { backgroundColor: COLORS.bgTertiary },
                  ]}
                >
                  <Text
                    style={[
                      styles.sevText,
                      {
                        color:
                          a.severity === "critical"
                            ? COLORS.error
                            : a.severity === "warning"
                              ? COLORS.warning
                              : COLORS.textSecondary,
                      },
                    ]}
                  >
                    {a.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alertTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary, flex: 1 },
  msg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  time: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 6 },
  sevChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 8 },
  sevText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginTop: SPACING.md },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
});
