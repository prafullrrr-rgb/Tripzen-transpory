import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Plan = {
  id: string;
  name: string;
  track: "school" | "operator" | "parent";
  price_monthly: number;
  price_annual?: number | null;
  max_students?: number;
  max_buses?: number;
  max_children?: number;
  per_bus?: boolean;
  min_buses?: number;
  currency: string;
  features: string[];
  highlight?: boolean;
};

type Subscription = {
  id: string;
  plan_id: string;
  plan_name: string;
  track: string;
  billing_cycle: "monthly" | "annual";
  amount: number;
  currency: string;
  status: "trial" | "active" | "past_due" | "cancelled";
  trial_end?: string;
  current_period_end?: string;
};

const FEATURE_LABELS: Record<string, string> = {
  live_tracking: "Live GPS tracking",
  qr_boarding: "QR boarding",
  push: "Push notifications",
  chat: "In-app chat",
  incidents: "Incident reports",
  multi_language: "Multi-language",
  csv_import: "Bulk CSV import",
  broadcast: "Broadcast templates",
  revenue_dash: "Revenue dashboard",
  ai_summaries: "AI weekly summaries",
  custom_branding: "Custom branding",
  sso: "Single Sign-On (SSO)",
  api_access: "API access",
  priority_support: "Priority 24/7 support",
  vehicle_logs: "Vehicle maintenance logs",
};

export default function AdminSubscription() {
  const router = useRouter();
  const [track, setTrack] = useState<"school" | "operator">("school");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api.get<{ plans: Plan[] }>(`/plans?track=${track}`),
        api.get<{ subscription: Subscription | null }>("/subscriptions/me"),
      ]);
      setPlans(p.plans);
      setCurrent(c.subscription);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [track]);

  useEffect(() => {
    load();
  }, [load]);

  const startTrial = async (plan: Plan) => {
    setActing(true);
    try {
      const sub = await api.post<Subscription>("/subscriptions", {
        plan_id: plan.id,
        billing_cycle: billingCycle,
        org_name: "My School",
        bus_count: plan.per_bus ? plan.min_buses || 5 : 1,
      });
      Alert.alert("🎉 Free trial started!", `30-day free trial on ${plan.name} — enjoy!`);
      setCurrent(sub);
    } catch (e: any) {
      Alert.alert("Could not start", e.message || "Try again");
    } finally {
      setActing(false);
    }
  };

  const upgradePlan = async (plan: Plan) => {
    if (!current) return;
    setActing(true);
    try {
      await api.post(`/subscriptions/${current.id}/upgrade`, {
        new_plan_id: plan.id,
        billing_cycle: billingCycle,
      });
      Alert.alert("✨ Upgraded!", `You're now on ${plan.name}`);
      load();
    } catch (e: any) {
      Alert.alert("Upgrade failed", e.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}>
        {/* Current plan card */}
        {current ? (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>CURRENT PLAN</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Text style={styles.currentName}>{current.plan_name}</Text>
              <View style={[styles.statusChip, current.status === "trial" ? styles.chipTrial : styles.chipActive]}>
                <Text style={styles.statusText}>{current.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.currentPrice}>
              £{current.amount.toFixed(2)} / {current.billing_cycle}
            </Text>
            {current.trial_end && current.status === "trial" ? (
              <Text style={styles.trialInfo}>
                Free trial ends {new Date(current.trial_end).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.trialBanner}>
            <Ionicons name="gift" size={24} color={COLORS.accent} />
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={styles.bannerTitle}>30-Day Free Trial</Text>
              <Text style={styles.bannerSub}>No credit card required. Cancel anytime.</Text>
            </View>
          </View>
        )}

        {/* Track toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, track === "school" && styles.toggleActive]}
            onPress={() => setTrack("school")}
          >
            <Text style={[styles.toggleText, track === "school" && styles.toggleTextActive]}>
              Schools
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, track === "operator" && styles.toggleActive]}
            onPress={() => setTrack("operator")}
          >
            <Text style={[styles.toggleText, track === "operator" && styles.toggleTextActive]}>
              Bus Operators
            </Text>
          </TouchableOpacity>
        </View>

        {/* Billing cycle */}
        <View style={styles.cycleRow}>
          <TouchableOpacity
            style={[styles.cyclePill, billingCycle === "monthly" && styles.cyclePillActive]}
            onPress={() => setBillingCycle("monthly")}
          >
            <Text style={[styles.cycleText, billingCycle === "monthly" && { color: COLORS.primary }]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cyclePill, billingCycle === "annual" && styles.cyclePillActive]}
            onPress={() => setBillingCycle("annual")}
          >
            <Text style={[styles.cycleText, billingCycle === "annual" && { color: COLORS.primary }]}>
              Annual <Text style={{ color: COLORS.success, fontSize: 11 }}>(20% off)</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {plans.map((p) => {
          const isCurrent = current?.plan_id === p.id;
          const price = billingCycle === "annual" && p.price_annual ? p.price_annual : p.price_monthly;
          const period = billingCycle === "annual" ? "/ year" : (p.per_bus ? "/ bus / mo" : "/ month");
          return (
            <View
              key={p.id}
              style={[styles.planCard, p.highlight && styles.planCardHighlight, isCurrent && styles.planCardCurrent]}
              testID={`plan-${p.id}`}
            >
              {p.highlight ? (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              ) : null}
              <Text style={styles.planName}>{p.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceMain}>£{price.toFixed(0)}</Text>
                <Text style={styles.pricePeriod}>{period}</Text>
              </View>
              {p.per_bus ? (
                <Text style={styles.minBuses}>Min {p.min_buses} buses · volume discount</Text>
              ) : null}
              <View style={styles.limits}>
                {p.max_students !== undefined && p.max_students !== null ? (
                  <Text style={styles.limitText}>• {p.max_students === -1 ? "Unlimited" : `Up to ${p.max_students}`} students</Text>
                ) : null}
                {p.max_buses !== undefined && p.max_buses !== null && !p.per_bus ? (
                  <Text style={styles.limitText}>• {p.max_buses === -1 ? "Unlimited" : `Up to ${p.max_buses}`} buses</Text>
                ) : null}
              </View>
              <View style={styles.featureList}>
                {p.features.slice(0, 6).map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={styles.featureText}>{FEATURE_LABELS[f] || f}</Text>
                  </View>
                ))}
                {p.features.length > 6 ? (
                  <Text style={styles.moreFeatures}>+ {p.features.length - 6} more</Text>
                ) : null}
              </View>
              <TouchableOpacity
                disabled={isCurrent || acting}
                style={[styles.ctaBtn, isCurrent && styles.ctaBtnDisabled, p.highlight && styles.ctaBtnHighlight]}
                onPress={() => (current ? upgradePlan(p) : startTrial(p))}
              >
                <Text style={[styles.ctaText, p.highlight && { color: COLORS.primary }]}>
                  {isCurrent ? "Current Plan" : current ? "Switch to " + p.name : "Start Free Trial"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={styles.footnote}>
          All plans include free 30-day trial. Cancel anytime. VAT applied at checkout for UK customers.
        </Text>
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
  currentCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  currentLabel: { fontSize: 11, color: COLORS.accent, fontWeight: "800", letterSpacing: 1 },
  currentName: { fontSize: 26, fontWeight: "800", color: "#fff" },
  currentPrice: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: SPACING.sm },
  trialInfo: { fontSize: 12, color: COLORS.accent, marginTop: 4, fontWeight: "600" },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipTrial: { backgroundColor: COLORS.accent },
  chipActive: { backgroundColor: COLORS.success },
  statusText: { fontSize: 10, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.accentLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  bannerTitle: { fontSize: 15, fontWeight: "800", color: COLORS.primary },
  bannerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  toggleRow: { flexDirection: "row", backgroundColor: COLORS.bg, borderRadius: 12, padding: 4, marginBottom: SPACING.md },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary },
  toggleTextActive: { color: "#fff" },
  cycleRow: { flexDirection: "row", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  cyclePill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  cyclePillActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  cycleText: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary },
  planCard: {
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: "relative",
  },
  planCardHighlight: { borderColor: COLORS.accent, borderWidth: 2 },
  planCardCurrent: { borderColor: COLORS.success, borderWidth: 2 },
  popularBadge: { position: "absolute", top: -10, right: SPACING.md, backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  popularText: { fontSize: 10, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },
  planName: { fontSize: 20, fontWeight: "800", color: COLORS.primary },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  priceMain: { fontSize: 36, fontWeight: "800", color: COLORS.primary },
  pricePeriod: { fontSize: 14, color: COLORS.textSecondary, marginLeft: 4 },
  minBuses: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  limits: { marginTop: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  limitText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600", marginVertical: 2 },
  featureList: { marginTop: SPACING.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
  featureText: { fontSize: 12, color: COLORS.textPrimary },
  moreFeatures: { fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic", marginTop: 4 },
  ctaBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  ctaBtnHighlight: { backgroundColor: COLORS.accent },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  footnote: { fontSize: 11, color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.md, lineHeight: 16 },
});
