import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Stop = { id: string; name: string; lat: number; lng: number; order: number; eta?: string };
type Route = {
  id: string;
  name: string;
  bus_number?: string;
  stops: Stop[];
  shift: string;
  student_count: number;
};
type Trip = {
  id: string;
  route_id: string;
  route_name: string;
  current_lat: number;
  current_lng: number;
  current_stop_index: number;
  status: string;
  boarded_student_ids: string[];
  checked_out_student_ids: string[];
};

export default function DriverHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const simulateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([
        api.get<Route[]>("/routes"),
        api.get<Trip[]>("/trips/active"),
      ]);
      setRoutes(r);
      setActiveTrip(t[0] || null);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Simulated movement
  useEffect(() => {
    if (simulateRef.current) {
      clearInterval(simulateRef.current);
      simulateRef.current = null;
    }
    if (!simulate || !activeTrip) return;
    const route = routes.find((r) => r.id === activeTrip.route_id);
    if (!route) return;
    simulateRef.current = setInterval(async () => {
      try {
        const trip = await api.get<Trip>(`/trips/${activeTrip.id}`);
        const nextIdx = Math.min(trip.current_stop_index + 1, route.stops.length - 1);
        const target = route.stops[nextIdx];
        if (!target) return;
        // Move toward the next stop in small steps
        const dx = (target.lat - trip.current_lat) * 0.25;
        const dy = (target.lng - trip.current_lng) * 0.25;
        const newLat = trip.current_lat + dx;
        const newLng = trip.current_lng + dy;
        const reached = Math.abs(target.lat - newLat) < 0.001 && Math.abs(target.lng - newLng) < 0.001;
        const updated = await api.post<Trip>(`/trips/${activeTrip.id}/location`, {
          lat: reached ? target.lat : newLat,
          lng: reached ? target.lng : newLng,
          stop_index: reached ? nextIdx : trip.current_stop_index,
        });
        setActiveTrip(updated);
      } catch {
        // silent
      }
    }, 3000);
    return () => {
      if (simulateRef.current) clearInterval(simulateRef.current);
    };
  }, [simulate, activeTrip, routes]);

  const startRoute = async (route: Route) => {
    setStarting(true);
    try {
      const trip = await api.post<Trip>("/trips/start", { route_id: route.id });
      setActiveTrip(trip);
    } catch (e: any) {
      Alert.alert("Could not start", e.message || "Try again");
    } finally {
      setStarting(false);
    }
  };

  const endRoute = async () => {
    if (!activeTrip) return;
    Alert.alert("End route?", "Mark this route as completed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post(`/trips/${activeTrip.id}/end`);
            setActiveTrip(null);
            setSimulate(false);
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const activeRoute = activeTrip ? routes.find((r) => r.id === activeTrip.route_id) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-home-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.subheader}>Welcome back</Text>
            <Text style={styles.title}>{user?.full_name?.split(" ")[0] || "Driver"}</Text>
          </View>
          <View style={styles.busIconBox}>
            <Ionicons name="bus" size={28} color={COLORS.primary} />
          </View>
        </View>

        {/* Active Trip */}
        {activeTrip && activeRoute && (
          <View style={styles.activeCard} testID="active-trip-card">
            <View style={styles.activeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeBadge}>● LIVE ROUTE</Text>
                <Text style={styles.routeNameBig}>{activeRoute.name}</Text>
                <Text style={styles.routeMeta}>
                  {activeRoute.bus_number} • {activeRoute.student_count} students
                </Text>
              </View>
              <TouchableOpacity testID="end-route-btn" style={styles.endBtn} onPress={endRoute}>
                <Text style={styles.endBtnText}>End</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.simRow}>
              <View>
                <Text style={styles.simLabel}>Simulate Movement</Text>
                <Text style={styles.simSub}>Auto-advance bus position for demo</Text>
              </View>
              <Switch
                testID="simulate-toggle"
                value={simulate}
                onValueChange={setSimulate}
                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                thumbColor={COLORS.bg}
              />
            </View>

            {/* Stops timeline */}
            <View style={styles.timeline}>
              {activeRoute.stops.map((stop, idx) => {
                const isActive = idx === activeTrip.current_stop_index;
                const isPast = idx < activeTrip.current_stop_index;
                return (
                  <View key={stop.id} style={styles.timelineRow}>
                    <View style={styles.timelineDotCol}>
                      <View
                        style={[
                          styles.timelineDot,
                          isPast && { backgroundColor: COLORS.success, borderColor: COLORS.success },
                          isActive && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
                        ]}
                      >
                        {isPast && <Ionicons name="checkmark" size={10} color="#fff" />}
                      </View>
                      {idx < activeRoute.stops.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            isPast && { backgroundColor: COLORS.success },
                          ]}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 14 }}>
                      <Text style={[styles.stopName, isActive && { color: COLORS.primary, fontWeight: "800" }]}>
                        {stop.name}
                      </Text>
                      <Text style={styles.stopEta}>{stop.eta || ""}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              testID="open-scanner-btn"
              style={styles.scanBtn}
              onPress={() => router.push("/driver/scan")}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code" size={20} color={COLORS.primary} />
              <Text style={styles.scanBtnText}>Scan Child</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Available routes */}
        {!activeTrip && (
          <>
            <Text style={styles.sectionTitle}>Today's routes</Text>
            {routes.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="map-outline" size={40} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No routes assigned</Text>
              </View>
            ) : (
              routes.map((r) => (
                <View key={r.id} style={styles.routeCard} testID={`route-card-${r.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeNameBig}>{r.name}</Text>
                    <Text style={styles.routeMeta}>
                      {r.bus_number} • {r.stops.length} stops • {r.student_count} students
                    </Text>
                    <Text style={styles.shiftChip}>
                      {r.shift === "morning" ? "🌅 Morning" : "🌆 Afternoon"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    testID={`start-route-${r.id}`}
                    style={[styles.startBtn, starting && { opacity: 0.7 }]}
                    onPress={() => startRoute(r)}
                    disabled={starting}
                  >
                    {starting ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <>
                        <Ionicons name="play" size={14} color={COLORS.primary} />
                        <Text style={styles.startBtnText}>Start</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  subheader: { fontSize: 13, color: COLORS.textSecondary },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  busIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCard: {
    backgroundColor: COLORS.bg,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeHeader: { flexDirection: "row", alignItems: "flex-start" },
  activeBadge: { fontSize: 10, fontWeight: "800", color: COLORS.success, letterSpacing: 0.5 },
  routeNameBig: { fontSize: 20, fontWeight: "800", color: COLORS.primary, marginTop: 4 },
  routeMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  endBtn: {
    backgroundColor: COLORS.errorBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 10,
  },
  endBtnText: { color: COLORS.error, fontWeight: "800", fontSize: 12 },
  simRow: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  simLabel: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  simSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  timeline: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  timelineRow: { flexDirection: "row" },
  timelineDotCol: { width: 30, alignItems: "center" },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 2 },
  stopName: { fontSize: 14, color: COLORS.textPrimary, fontWeight: "600" },
  stopEta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  scanBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shiftChip: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { color: COLORS.textSecondary, marginTop: SPACING.sm },
});
