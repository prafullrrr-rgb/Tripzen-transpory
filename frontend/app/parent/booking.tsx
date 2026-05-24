import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import { useStripe } from "@/src/utils/stripe";

type Student = { id: string; name: string; school?: string; route_id?: string };
type Route = { id: string; name: string; bus_number?: string };

const PLANS = [
  { key: "monthly", label: "Monthly Plan", price: 89.99, sub: "Unlimited daily trips • Best value" },
  { key: "single", label: "Single Trip", price: 4.5, sub: "One-time ride" },
];

export default function Booking() {
  const router = useRouter();
  const { t } = useTranslation();
  const stripeHooks = useStripe();
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [routeId, setRouteId] = useState<string>("");
  const [plan, setPlan] = useState<"monthly" | "single">("monthly");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paidMonthlyCount, setPaidMonthlyCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [s, r, b] = await Promise.all([
          api.get<Student[]>("/students"),
          api.get<Route[]>("/routes"),
          api.get<any[]>("/bookings").catch(() => []),
        ]);
        setStudents(s);
        setRoutes(r);
        if (s[0]) setStudentId(s[0].id);
        if (s[0]?.route_id) setRouteId(s[0].route_id);
        else if (r[0]) setRouteId(r[0].id);
        setPaidMonthlyCount(b.filter((x) => x.status === "paid" && x.plan === "monthly").length);
      } catch (e: any) {
        Alert.alert("Error", e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePay = async () => {
    if (!studentId || !routeId) {
      Alert.alert("Missing info", "Pick a child and route");
      return;
    }
    setPaying(true);
    try {
      // Step 1: create booking on backend
      const booking = await api.post<{ id: string; amount: number }>("/bookings", {
        student_id: studentId,
        route_id: routeId,
        plan,
      });

      // Step 2: try native Stripe PaymentSheet (only if SDK + key present)
      const initPaymentSheet = stripeHooks?.initPaymentSheet;
      const presentPaymentSheet = stripeHooks?.presentPaymentSheet;
      const useRealStripe =
        Platform.OS !== "web" &&
        initPaymentSheet &&
        presentPaymentSheet &&
        !!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (useRealStripe) {
        try {
          const pi = await api.post<{ client_secret: string; publishable_key: string; mocked: boolean }>(
            `/bookings/${booking.id}/payment-intent`,
          );
          if (!pi.mocked) {
            const initRes = await initPaymentSheet({
              merchantDisplayName: "TripZen",
              paymentIntentClientSecret: pi.client_secret,
              defaultBillingDetails: undefined,
              allowsDelayedPaymentMethods: false,
            });
            if (initRes?.error) throw new Error(initRes.error.message);
            const present = await presentPaymentSheet();
            if (present?.error) {
              if (present.error.code === "Canceled") {
                throw new Error("Cancelled");
              }
              throw new Error(present.error.message);
            }
            const confirmed = await api.post<{ ok: boolean; amount: number }>(
              `/bookings/${booking.id}/confirm-payment`,
            );
            Alert.alert(t("booking.paymentSuccess"), `£${confirmed.amount.toFixed(2)} charged`, [
              { text: "OK", onPress: () => router.back() },
            ]);
            return;
          }
        } catch (e: any) {
          if (e.message === "Cancelled") {
            return;
          }
          // Fall back to mock pay
        }
      }

      // Mock fallback (web or no Stripe key)
      const res = await api.post<{ ok: boolean; payment_ref: string; amount: number }>(
        `/bookings/${booking.id}/pay`,
      );
      Alert.alert(
        t("booking.paymentSuccess"),
        `£${res.amount.toFixed(2)} charged\nRef: ${res.payment_ref}\n\n${useRealStripe ? "" : "(Mock — set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY + dev build for real Stripe)"}`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert("Payment failed", e.message || "Try again");
    } finally {
      setPaying(false);
    }
  };

  const selectedPlan = PLANS.find((p) => p.key === plan)!;
  const showsSibling = plan === "monthly" && paidMonthlyCount >= 1;
  const discountAmount = showsSibling ? +(selectedPlan.price * 0.2).toFixed(2) : 0;
  const finalPrice = +(selectedPlan.price - discountAmount).toFixed(2);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="booking-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="booking-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Book a Trip</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}>
          <Text style={styles.label}>Select Child</Text>
          {students.length === 0 ? (
            <Text style={styles.empty}>No children. Add one from the Account screen.</Text>
          ) : (
            students.map((s) => (
              <TouchableOpacity
                key={s.id}
                testID={`book-child-${s.id}`}
                style={[styles.optionCard, studentId === s.id && styles.optionCardActive]}
                onPress={() => setStudentId(s.id)}
              >
                <Ionicons
                  name={studentId === s.id ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={studentId === s.id ? COLORS.accent : COLORS.textSecondary}
                />
                <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                  <Text style={styles.optTitle}>{s.name}</Text>
                  <Text style={styles.optSub}>{s.school || "—"}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.label}>Select Route</Text>
          {routes.map((r) => (
            <TouchableOpacity
              key={r.id}
              testID={`book-route-${r.id}`}
              style={[styles.optionCard, routeId === r.id && styles.optionCardActive]}
              onPress={() => setRouteId(r.id)}
            >
              <Ionicons
                name={routeId === r.id ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={routeId === r.id ? COLORS.accent : COLORS.textSecondary}
              />
              <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                <Text style={styles.optTitle}>{r.name}</Text>
                <Text style={styles.optSub}>{r.bus_number || "Bus TBA"}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Choose Plan</Text>
          {PLANS.map((p) => (
            <TouchableOpacity
              key={p.key}
              testID={`book-plan-${p.key}`}
              style={[styles.planCard, plan === p.key && styles.planCardActive]}
              onPress={() => setPlan(p.key as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{p.label}</Text>
                <Text style={styles.planSub}>{p.sub}</Text>
              </View>
              <Text style={styles.planPrice}>£{p.price}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.payBar}>
          <View>
            <Text style={styles.payBarLabel}>Total</Text>
            <Text style={styles.payBarAmount}>£{selectedPlan.price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            testID="pay-with-stripe-btn"
            style={[styles.payBtn, paying && { opacity: 0.7 }]}
            onPress={handlePay}
            disabled={paying}
          >
            {paying ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="card" size={18} color={COLORS.primary} />
                <Text style={styles.payBtnText}>Pay with Stripe</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  optionCardActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  optTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  optSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  planCardActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  planTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  planSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  planPrice: { fontSize: 22, fontWeight: "800", color: COLORS.primary },
  empty: { color: COLORS.textSecondary, marginTop: 6 },
  payBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payBarLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  payBarAmount: { fontSize: 22, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  discountText: { fontSize: 11, color: COLORS.success, fontWeight: "700", marginTop: 2 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  payBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
});
