import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
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
};

export default function ParentHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
          bookings.map((b) => (
            <View key={b.id} style={styles.card} testID={`booking-${b.id}`}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {b.plan === "monthly" ? "Monthly Plan" : "Single Trip"}
                </Text>
                <View
                  style={[
                    styles.badge,
                    b.status === "paid"
                      ? { backgroundColor: COLORS.successBg }
                      : { backgroundColor: COLORS.bgTertiary },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: b.status === "paid" ? COLORS.success : COLORS.textSecondary },
                    ]}
                  >
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
});
