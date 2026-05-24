import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Revenue = {
  total_revenue: number;
  paid_bookings: number;
  pending_bookings: number;
  currency: string;
};

type Booking = {
  id: string;
  parent_id: string;
  student_id: string;
  route_id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at?: string;
  payment_ref?: string;
};

type User = { id: string; full_name: string };
type Student = { id: string; name: string };

export default function ManageBookings() {
  const router = useRouter();
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, b, u, s] = await Promise.all([
        api.get<Revenue>("/admin/revenue"),
        api.get<Booking[]>("/bookings"),
        api.get<User[]>("/admin/users"),
        api.get<Student[]>("/students"),
      ]);
      setRevenue(r);
      setBookings(b);
      setUsers(u);
      setStudents(s);
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

  const findUser = (id: string) => users.find((u) => u.id === id);
  const findStudent = (id: string) => students.find((s) => s.id === id);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top"]} testID="manage-bookings-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="bookings-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Bookings & Revenue</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
          ) : (
            <>
              {/* Revenue card */}
              <View style={styles.revenueCard} testID="revenue-card">
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={styles.revenueAmount}>
                  £{(revenue?.total_revenue ?? 0).toFixed(2)}
                </Text>
                <View style={styles.revenueRow}>
                  <View style={styles.revenueItem}>
                    <Text style={styles.revNum}>{revenue?.paid_bookings ?? 0}</Text>
                    <Text style={styles.revSub}>Paid</Text>
                  </View>
                  <View style={styles.revenueDivider} />
                  <View style={styles.revenueItem}>
                    <Text style={styles.revNum}>{revenue?.pending_bookings ?? 0}</Text>
                    <Text style={styles.revSub}>Pending</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.section}>All bookings</Text>
              {bookings.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="receipt-outline" size={42} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>No bookings yet</Text>
                </View>
              ) : (
                bookings.map((b) => (
                  <View key={b.id} style={styles.card} testID={`booking-row-${b.id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {findStudent(b.student_id)?.name || "Student"}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {b.plan === "monthly" ? "Monthly Plan" : "Single Trip"} • Parent:{" "}
                        {findUser(b.parent_id)?.full_name || "—"}
                      </Text>
                      <Text style={styles.cardSub}>
                        Booked {new Date(b.created_at).toLocaleDateString()}
                        {b.payment_ref ? ` • Ref ${b.payment_ref.slice(0, 14)}…` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.amount}>£{b.amount.toFixed(2)}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          b.status === "paid"
                            ? { backgroundColor: COLORS.successBg }
                            : { backgroundColor: COLORS.warningBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: b.status === "paid" ? COLORS.success : COLORS.warning },
                          ]}
                        >
                          {b.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  revenueCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  revenueLabel: { fontSize: 12, color: COLORS.accentLight, fontWeight: "700", letterSpacing: 0.5 },
  revenueAmount: { fontSize: 36, fontWeight: "800", color: COLORS.accent, marginTop: 6, letterSpacing: -0.5 },
  revenueRow: {
    flexDirection: "row",
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(252, 184, 19, 0.2)",
  },
  revenueItem: { flex: 1, alignItems: "center" },
  revenueDivider: { width: 1, backgroundColor: "rgba(252, 184, 19, 0.2)" },
  revNum: { fontSize: 22, fontWeight: "800", color: COLORS.textInverse },
  revSub: { fontSize: 11, color: COLORS.accentLight, marginTop: 2 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  cardMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cardSub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  statusBadgeText: { fontSize: 9, fontWeight: "800" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm },
});
