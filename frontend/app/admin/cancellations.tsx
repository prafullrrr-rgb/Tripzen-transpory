import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type CancellationItem = {
  id: string;
  parent_name: string;
  parent_email: string;
  student_name: string;
  route_name: string;
  amount: number;
  paid_amount: number;
  refund_amount: number;
  kept_amount: number;
  non_refunded_amount?: number;
  refund_status?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  currency: string;
};

type Response = {
  cancellations: CancellationItem[];
  summary: {
    total_cancellations: number;
    total_paid: number;
    total_refunded: number;
    total_kept: number;
    currency: string;
  };
};

export default function AdminCancellations() {
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Response>("/admin/cancellations");
      setData(res);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const s = data?.summary;
  const items = data?.cancellations || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Cancellations</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.bgSecondary }]}>
            <Text style={styles.summaryLabel}>Total Cancellations</Text>
            <Text style={styles.summaryValue}>{s?.total_cancellations || 0}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.errorBg }]}>
            <Text style={styles.summaryLabel}>Net Kept</Text>
            <Text style={[styles.summaryValue, { color: COLORS.error }]}>
              £{(s?.total_kept || 0).toFixed(2)}
            </Text>
            <Text style={styles.summarySub}>not refunded</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.bgSecondary }]}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>£{(s?.total_paid || 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.bgSecondary }]}>
            <Text style={styles.summaryLabel}>Total Refunded</Text>
            <Text style={[styles.summaryValue, { color: COLORS.success }]}>
              £{(s?.total_refunded || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cancelled Bookings</Text>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No cancellations yet</Text>
          </View>
        ) : (
          items.map((c) => (
            <View key={c.id} style={styles.card} testID={`cancellation-${c.id}`}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{c.student_name}</Text>
                  <Text style={styles.parentInfo}>{c.parent_name} • {c.parent_email}</Text>
                  <Text style={styles.routeInfo}>🚌 {c.route_name}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{c.refund_status || "-"}</Text>
                </View>
              </View>

              <View style={styles.amountsRow}>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Paid</Text>
                  <Text style={styles.amountValue}>£{(c.paid_amount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Refunded</Text>
                  <Text style={[styles.amountValue, { color: COLORS.success }]}>
                    £{(c.refund_amount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Kept</Text>
                  <Text style={[styles.amountValue, { color: COLORS.error, fontWeight: "800" }]}>
                    £{(c.kept_amount || 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {c.cancellation_reason && (
                <Text style={styles.reason}>Reason: {c.cancellation_reason}</Text>
              )}
              {c.cancelled_at && (
                <Text style={styles.timestamp}>
                  {new Date(c.cancelled_at).toLocaleDateString()} {new Date(c.cancelled_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  summaryRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  summaryCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 22, fontWeight: "800", color: COLORS.primary, marginTop: 4 },
  summarySub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: COLORS.primary, marginTop: SPACING.md, marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  studentName: { fontSize: 15, fontWeight: "800", color: COLORS.primary },
  parentInfo: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  routeInfo: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  statusBadge: { backgroundColor: COLORS.warningBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: "700", color: COLORS.warning, textTransform: "uppercase" },
  amountsRow: { flexDirection: "row", marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  amountItem: { flex: 1, alignItems: "center" },
  amountLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "600", textTransform: "uppercase" },
  amountValue: { fontSize: 16, fontWeight: "700", color: COLORS.primary, marginTop: 2 },
  reason: { fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.sm, fontStyle: "italic" },
  timestamp: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4 },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { color: COLORS.textSecondary, marginTop: SPACING.sm },
});
