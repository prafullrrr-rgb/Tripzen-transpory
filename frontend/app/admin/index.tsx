import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Stats = {
  total_routes: number;
  total_students: number;
  active_buses: number;
  on_time_percent: number;
  completed_today: number;
  total_drivers: number;
  total_parents: number;
};

type Alert = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
};

export default function AdminOverview() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.get<Stats>("/admin/stats"),
        api.get<Alert[]>("/admin/alerts"),
      ]);
      setStats(s);
      setAlerts(a);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-overview-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subtitle}>TripZen Admin</Text>
            <Text style={styles.title}>Overview</Text>
          </View>
          <View style={styles.todayPill}>
            <Text style={styles.todayText}>Today</Text>
          </View>
        </View>

        {/* Stat grid */}
        <View style={styles.grid}>
          <StatCard
            icon="git-network"
            label="Total Routes"
            value={stats?.total_routes ?? 0}
            tone="primary"
            testID="stat-routes"
          />
          <StatCard
            icon="people"
            label="Total Students"
            value={stats?.total_students ?? 0}
            tone="primary"
            testID="stat-students"
          />
          <StatCard
            icon="bus"
            label="Active Buses"
            value={stats?.active_buses ?? 0}
            tone="accent"
            testID="stat-buses"
          />
          <StatCard
            icon="checkmark-circle"
            label="On Time"
            value={`${stats?.on_time_percent ?? 0}%`}
            tone="success"
            testID="stat-ontime"
          />
        </View>

        {/* Secondary stats */}
        <View style={styles.secondaryRow}>
          <SmallStat label="Drivers" value={stats?.total_drivers ?? 0} />
          <SmallStat label="Parents" value={stats?.total_parents ?? 0} />
          <SmallStat label="Done today" value={stats?.completed_today ?? 0} />
        </View>

        {/* Live map preview */}
        <TouchableOpacity
          testID="open-livemap-btn"
          style={styles.mapPreview}
          onPress={() => router.push("/admin/map")}
          activeOpacity={0.85}
        >
          <View style={styles.mapIconBox}>
            <Ionicons name="map" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>Live Map</Text>
            <Text style={styles.mapSub}>Track all {stats?.active_buses ?? 0} active buses</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Cancellations dashboard quick link */}
        <TouchableOpacity
          testID="open-cancellations-btn"
          style={styles.mapPreview}
          onPress={() => router.push("/admin/cancellations")}
          activeOpacity={0.85}
        >
          <View style={[styles.mapIconBox, { backgroundColor: COLORS.errorBg }]}>
            <Ionicons name="close-circle" size={22} color={COLORS.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>Cancellations & Refunds</Text>
            <Text style={styles.mapSub}>Track cancelled bookings and non-refunded amounts</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Subscription plan quick link */}
        <TouchableOpacity
          testID="open-subscription-btn"
          style={styles.mapPreview}
          onPress={() => router.push("/admin/subscription")}
          activeOpacity={0.85}
        >
          <View style={[styles.mapIconBox, { backgroundColor: COLORS.accentLight }]}>
            <Ionicons name="card" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>Subscription & Billing</Text>
            <Text style={styles.mapSub}>Manage your school plan, upgrade or downgrade</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Broadcast quick link */}
        <TouchableOpacity
          testID="open-broadcast-btn"
          style={styles.mapPreview}
          onPress={() => router.push("/admin/broadcast")}
          activeOpacity={0.85}
        >
          <View style={[styles.mapIconBox, { backgroundColor: COLORS.warningBg }]}>
            <Ionicons name="megaphone" size={22} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>Broadcast Message</Text>
            <Text style={styles.mapSub}>Send snow day, delay, or custom alerts to all parents</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* QR Badges print quick link */}
        <TouchableOpacity
          testID="open-qr-badges-btn"
          style={styles.mapPreview}
          onPress={() => router.push("/admin/qr-badges")}
          activeOpacity={0.85}
        >
          <View style={[styles.mapIconBox, { backgroundColor: COLORS.bgTertiary }]}>
            <Ionicons name="qr-code" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>Print QR Badges</Text>
            <Text style={styles.mapSub}>Bulk print student boarding badges (8 per A4)</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* CSV Import quick link */}
        <TouchableOpacity
          testID="open-import-btn"
          style={styles.mapPreview}
          onPress={() => router.push("/admin/import-students")}
          activeOpacity={0.85}
        >
          <View style={[styles.mapIconBox, { backgroundColor: COLORS.successBg }]}>
            <Ionicons name="cloud-upload" size={22} color={COLORS.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>Bulk Import Students</Text>
            <Text style={styles.mapSub}>Upload CSV to add many students at once</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          <TouchableOpacity onPress={() => router.push("/admin/alerts")}>
            <Text style={styles.linkText}>View all</Text>
          </TouchableOpacity>
        </View>
        {alerts.slice(0, 4).map((a) => (
          <View key={a.id} style={styles.alertCard} testID={`alert-${a.id}`}>
            <View
              style={[
                styles.alertIcon,
                a.severity === "critical"
                  ? { backgroundColor: COLORS.errorBg }
                  : a.severity === "warning"
                    ? { backgroundColor: COLORS.warningBg }
                    : { backgroundColor: COLORS.bgTertiary },
              ]}
            >
              <Ionicons
                name="warning"
                size={16}
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
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertMsg}>{a.message}</Text>
            </View>
            <Text style={styles.alertTime}>
              {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, tone, testID }: any) {
  const toneStyle =
    tone === "accent"
      ? { backgroundColor: COLORS.accentLight, color: COLORS.primary }
      : tone === "success"
        ? { backgroundColor: COLORS.successBg, color: COLORS.success }
        : { backgroundColor: COLORS.bg, color: COLORS.primary };
  return (
    <View style={[styles.statCard, { backgroundColor: toneStyle.backgroundColor }]} testID={testID}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={toneStyle.color} />
      </View>
      <Text style={[styles.statValue, { color: toneStyle.color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SmallStat({ label, value }: any) {
  return (
    <View style={styles.smallStat}>
      <Text style={styles.smallVal}>{value}</Text>
      <Text style={styles.smallLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  subtitle: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.5 },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  todayPill: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  todayText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    width: "48.5%",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(15, 27, 61, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  statValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "600" },
  secondaryRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  smallStat: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  smallVal: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  smallLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, fontWeight: "600" },
  mapPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  mapTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  mapSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  linkText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    marginHorizontal: SPACING.lg,
    marginBottom: 6,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  alertTitle: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  alertMsg: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  alertTime: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 8 },
});
