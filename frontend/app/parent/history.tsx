import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Booking = {
  id: string;
  student_id: string;
  route_id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at?: string;
  cancelled_at?: string;
  refund_amount?: number;
  non_refunded_amount?: number;
  skip_dates?: { date: string; reason: string }[];
};

export default function ParentHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Booking[]>("/bookings");
      setBookings(data);
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

  const handleSkipDay = (b: Booking) => {
    Alert.prompt(
      "Skip a Day",
      "Which date should we mark as skipped? (YYYY-MM-DD)",
      async (date) => {
        if (!date) return;
        setActing(b.id);
        try {
          await api.post(`/bookings/${b.id}/skip-day`, { date, reason: "Personal" });
          Alert.alert("✓ Skipped", `Driver notified for ${date}. No bus pickup that day.`);
          load();
        } catch (e: any) {
          Alert.alert("Could not skip", e.message || "Try again");
        } finally {
          setActing(null);
        }
      },
      "plain-text",
      new Date(Date.now() + 86400000).toISOString().split("T")[0]
    );
  };

  const handleCancel = (b: Booking) => {
    Alert.alert(
      "Cancel Booking?",
      `You'll get an 80% refund (£${(b.amount * 0.8).toFixed(2)}). Non-refundable: £${(b.amount * 0.2).toFixed(2)}.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel & Refund",
          style: "destructive",
          onPress: async () => {
            setActing(b.id);
            try {
              const res: any = await api.post(`/bookings/${b.id}/cancel`, {
                reason: "Cancelled by parent",
                refund_pct: 80,
              });
              Alert.alert(
                "✓ Cancelled",
                `Refund: £${res.refund_amount.toFixed(2)}\nNon-refundable: £${res.non_refunded_amount.toFixed(2)}`
              );
              load();
            } catch (e: any) {
              Alert.alert("Could not cancel", e.message || "Try again");
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="parent-history-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <Text style={styles.subtitle}>Bookings & past trips</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
        ) : bookings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No bookings yet</Text>
          </View>
        ) : (
          bookings.map((b) => {
            const isCancelled = b.status === "cancelled";
            const isPaid = b.status === "paid";
            const statusColors = isCancelled
              ? { bg: COLORS.errorBg, text: COLORS.error }
              : isPaid
              ? { bg: COLORS.successBg, text: COLORS.success }
              : { bg: COLORS.bgTertiary, text: COLORS.textSecondary };
            return (
              <View key={b.id} style={styles.card} testID={`booking-${b.id}`}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>
                    {b.plan === "monthly" ? "Monthly Plan" : "Single Trip"}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.badgeText, { color: statusColors.text }]}>
                      {b.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.amount}>
                  £{b.amount.toFixed(2)} {b.currency}
                </Text>
                <Text style={styles.meta}>
                  Booked {new Date(b.created_at).toLocaleDateString()}
                  {b.paid_at ? ` • Paid ${new Date(b.paid_at).toLocaleDateString()}` : ""}
                </Text>

                {isCancelled && b.refund_amount !== undefined && (
                  <View style={styles.refundBox}>
                    <Text style={styles.refundLabel}>
                      Refund: <Text style={styles.refundOk}>£{b.refund_amount.toFixed(2)}</Text>
                    </Text>
                    <Text style={styles.refundLabel}>
                      Non-refundable:{" "}
                      <Text style={styles.refundBad}>£{(b.non_refunded_amount || 0).toFixed(2)}</Text>
                    </Text>
                  </View>
                )}

                {b.skip_dates && b.skip_dates.length > 0 && (
                  <View style={styles.skipList}>
                    <Text style={styles.skipTitle}>Skip dates:</Text>
                    {b.skip_dates.map((s, i) => (
                      <Text key={i} style={styles.skipItem}>
                        • {s.date} ({s.reason})
                      </Text>
                    ))}
                  </View>
                )}

                {isPaid && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSkipDay(b)}
                      disabled={acting === b.id}
                      testID={`skip-day-${b.id}`}
                    >
                      <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.actionText}>Skip a Day</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: COLORS.error }]}
                      onPress={() => handleCancel(b)}
                      disabled={acting === b.id}
                      testID={`cancel-${b.id}`}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
                      <Text style={[styles.actionText, { color: COLORS.error }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  amount: { fontSize: 22, fontWeight: "800", color: COLORS.primary, marginTop: SPACING.sm },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm },
  refundBox: {
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  refundLabel: { fontSize: 12, color: COLORS.textSecondary, marginVertical: 2 },
  refundOk: { color: COLORS.success, fontWeight: "700" },
  refundBad: { color: COLORS.error, fontWeight: "700" },
  skipList: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  skipTitle: { fontSize: 12, fontWeight: "700", color: COLORS.primary, marginBottom: 4 },
  skipItem: { fontSize: 11, color: COLORS.textSecondary },
  actionRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
});
