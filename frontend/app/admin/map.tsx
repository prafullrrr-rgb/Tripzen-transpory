import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "@/src/components/MapView";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Trip = {
  id: string;
  route_name: string;
  current_lat: number;
  current_lng: number;
  status: string;
};

export default function AdminMap() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api.get<Trip[]>("/trips/active");
      setTrips(t);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const centerLat = trips[0]?.current_lat ?? 51.5174;
  const centerLng = trips[0]?.current_lng ?? -0.1278;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-map-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Live Map</Text>
        <View style={styles.activeChip}>
          <View style={styles.liveDot} />
          <Text style={styles.activeText}>{trips.length} active</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
        ) : (
          <MapView
            style={StyleSheet.absoluteFill}
            region={{
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            {trips.map((t) => (
              <Marker
                key={t.id}
                coordinate={{ latitude: t.current_lat, longitude: t.current_lng }}
                title={t.route_name}
              >
                <View style={styles.busMarker}>
                  <Ionicons name="bus" size={16} color={COLORS.primary} />
                </View>
              </Marker>
            ))}
          </MapView>
        )}
      </View>

      <ScrollView
        style={styles.tripList}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.section}>Active trips</Text>
        {trips.length === 0 ? (
          <Text style={styles.empty}>No active trips right now</Text>
        ) : (
          trips.map((t) => (
            <View key={t.id} style={styles.tripCard} testID={`trip-${t.id}`}>
              <View style={styles.tripIcon}>
                <Ionicons name="bus" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripTitle}>{t.route_name}</Text>
                <Text style={styles.tripCoords}>
                  {t.current_lat.toFixed(4)}, {t.current_lng.toFixed(4)}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.dotGreen} />
                <Text style={styles.statusBadgeText}>LIVE</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.primary },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  activeText: { fontSize: 11, fontWeight: "800", color: COLORS.success },
  mapContainer: {
    height: 280,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: COLORS.bgTertiary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  busMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.bg,
  },
  tripList: { flex: 1, marginTop: SPACING.md },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  empty: { color: COLORS.textSecondary, fontSize: 13, marginTop: SPACING.md, textAlign: "center" },
  tripCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tripIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  tripTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  tripCoords: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  statusBadgeText: { fontSize: 9, fontWeight: "800", color: COLORS.success },
});
