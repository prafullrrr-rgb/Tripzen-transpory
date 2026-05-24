import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from "@/src/components/MapView";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Student = {
  id: string;
  name: string;
  grade?: string;
  school?: string;
  avatar_url?: string;
  route_id?: string;
  qr_code: string;
};

type Trip = {
  id: string;
  route_id: string;
  route_name: string;
  status: string;
  current_lat: number;
  current_lng: number;
  current_stop_index: number;
  boarded_student_ids: string[];
  checked_out_student_ids: string[];
  eta_next_stop?: string;
};

type Route = {
  id: string;
  name: string;
  bus_number?: string;
  stops: { id: string; name: string; lat: number; lng: number; order: number; eta?: string }[];
};

export default function ParentHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Record<string, Route>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        api.get<Student[]>("/students"),
        api.get<Trip[]>("/trips/active"),
      ]);
      setStudents(s);
      setTrips(t);
      const routeIds = [...new Set(t.map((tr) => tr.route_id))];
      const loadedRoutes: Record<string, Route> = {};
      await Promise.all(
        routeIds.map(async (rid) => {
          try {
            loadedRoutes[rid] = await api.get<Route>(`/routes/${rid}`);
          } catch {
            // ignore
          }
        }),
      );
      setRoutes(loadedRoutes);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activeTrip = trips[0];
  const activeRoute = activeTrip ? routes[activeTrip.route_id] : null;
  const trackedStudent = students.find((s) => s.route_id === activeTrip?.route_id) || students[0];

  const isBoarded = activeTrip && trackedStudent && activeTrip.boarded_student_ids.includes(trackedStudent.id);
  const isCheckedOut = activeTrip && trackedStudent && activeTrip.checked_out_student_ids.includes(trackedStudent.id);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="parent-home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hello, {user?.full_name?.split(" ")[0] || "there"}</Text>
            <Text style={styles.subgreeting}>Here is today's update</Text>
          </View>
          <TouchableOpacity
            testID="parent-notifications-btn"
            style={styles.bellBtn}
            onPress={() => router.push("/parent/messages")}
          >
            <Ionicons name="notifications" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
        ) : students.length === 0 ? (
          <EmptyState
            icon="person-add"
            title="No children added yet"
            subtitle="Add your child profile and link them to a transport route."
            actionLabel="Book a Route"
            onAction={() => router.push("/parent/booking")}
          />
        ) : (
          <>
            {/* Trip status card */}
            {trackedStudent && (
              <View style={styles.tripCard} testID="trip-status-card">
                <View style={styles.tripRow}>
                  <Image
                    source={{
                      uri:
                        trackedStudent.avatar_url ||
                        "https://images.unsplash.com/photo-1693639257331-0bad8ac3913f?w=200",
                    }}
                    style={styles.avatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{trackedStudent.name}</Text>
                    <Text style={styles.routeName}>
                      {activeTrip ? activeTrip.route_name : "No active trip"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isCheckedOut
                        ? styles.statusSuccess
                        : isBoarded
                          ? styles.statusInfo
                          : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isCheckedOut
                          ? { color: COLORS.success }
                          : isBoarded
                            ? { color: COLORS.primary }
                            : { color: COLORS.textSecondary },
                      ]}
                    >
                      {isCheckedOut ? "Checked Out" : isBoarded ? "Boarded" : "Waiting"}
                    </Text>
                  </View>
                </View>
                {activeTrip && activeRoute && (
                  <View style={styles.etaRow}>
                    <Ionicons name="location" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.etaText}>
                      Next: {activeRoute.stops[activeTrip.current_stop_index + 1]?.name || "Final stop"}
                      {activeTrip.eta_next_stop ? `  •  ETA ${activeTrip.eta_next_stop}` : ""}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Live map */}
            {activeTrip && activeRoute && (
              <View style={styles.mapCard} testID="live-map-card">
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={styles.map}
                  region={{
                    latitude: activeTrip.current_lat,
                    longitude: activeTrip.current_lng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  pointerEvents={Platform.OS === "web" ? "none" : "auto"}
                >
                  <Marker
                    coordinate={{
                      latitude: activeTrip.current_lat,
                      longitude: activeTrip.current_lng,
                    }}
                    title="Bus"
                    description={activeTrip.route_name}
                  >
                    <View style={styles.busMarker}>
                      <Ionicons name="bus" size={18} color={COLORS.primary} />
                    </View>
                  </Marker>
                  {activeRoute.stops.map((stop) => (
                    <Marker
                      key={stop.id}
                      coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                      title={stop.name}
                      pinColor="#0F1B3D"
                    />
                  ))}
                  <Polyline
                    coordinates={activeRoute.stops.map((s) => ({ latitude: s.lat, longitude: s.lng }))}
                    strokeColor={COLORS.accent}
                    strokeWidth={3}
                  />
                </MapView>
                <View style={styles.mapOverlay}>
                  <View>
                    <Text style={styles.mapOverlayTitle}>On the way</Text>
                    <Text style={styles.mapOverlaySub}>
                      {activeRoute.bus_number || "Bus"} • Live tracking
                    </Text>
                  </View>
                  <View style={styles.liveDot} />
                </View>
              </View>
            )}

            {/* Quick actions */}
            <View style={styles.quickRow}>
              <QuickAction
                icon="calendar"
                label="Book Trip"
                onPress={() => router.push("/parent/booking")}
                testID="quick-book-btn"
              />
              <QuickAction
                icon="time"
                label="History"
                onPress={() => router.push("/parent/history")}
                testID="quick-history-btn"
              />
              <QuickAction
                icon="chatbubbles"
                label="Messages"
                onPress={() => router.push("/parent/messages")}
                testID="quick-messages-btn"
              />
            </View>

            {/* Children list */}
            <Text style={styles.sectionTitle}>Your children</Text>
            {students.map((s) => (
              <View key={s.id} style={styles.studentCard} testID={`student-card-${s.id}`}>
                <Image
                  source={{
                    uri:
                      s.avatar_url ||
                      "https://images.unsplash.com/photo-1693639257331-0bad8ac3913f?w=200",
                  }}
                  style={styles.smallAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{s.name}</Text>
                  <Text style={styles.smallMeta}>
                    {s.grade ? `${s.grade} • ` : ""}
                    {s.school || "School not set"}
                  </Text>
                </View>
                <View style={styles.qrChip}>
                  <Ionicons name="qr-code" size={14} color={COLORS.primary} />
                  <Text style={styles.qrChipText}>{s.qr_code.split("-")[1]}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickIconBox}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={32} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
      {actionLabel && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAction}>
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
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
    paddingBottom: SPACING.md,
  },
  greeting: { fontSize: 24, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  subgreeting: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tripCard: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  tripRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: SPACING.md, backgroundColor: COLORS.bgTertiary },
  studentName: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  routeName: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusSuccess: { backgroundColor: COLORS.successBg },
  statusInfo: { backgroundColor: COLORS.accentLight },
  statusPending: { backgroundColor: COLORS.bgTertiary },
  statusText: { fontSize: 11, fontWeight: "800" },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  etaText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  mapCard: {
    marginHorizontal: SPACING.lg,
    height: 240,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: COLORS.bgTertiary,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: { ...StyleSheet.absoluteFillObject },
  busMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.bg,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  mapOverlayTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  mapOverlaySub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  quickRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginTop: SPACING.sm },
  quickAction: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLabel: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  studentCard: {
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
  smallAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md, backgroundColor: COLORS.bgTertiary },
  smallMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  qrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  qrChipText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  empty: { alignItems: "center", paddingHorizontal: SPACING.lg, marginTop: 60 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, textAlign: "center" },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", marginTop: 6, marginBottom: SPACING.lg },
  emptyBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  emptyBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
});
