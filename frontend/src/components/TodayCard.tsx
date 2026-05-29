import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type TodayStatus = {
  student: { id: string; name: string; grade?: string };
  trip: any;
  status: "home" | "waiting" | "on_bus" | "dropped_off";
  status_label: string;
  events_today: Array<{ title: string; body: string; created_at: string; type: string }>;
};

const STATUS_COLOR: Record<string, { bg: string; text: string; icon: string }> = {
  home: { bg: COLORS.bgSecondary, text: COLORS.textSecondary, icon: "home" },
  waiting: { bg: COLORS.accentLight, text: COLORS.accent, icon: "hourglass" },
  on_bus: { bg: COLORS.successBg, text: COLORS.success, icon: "bus" },
  dropped_off: { bg: COLORS.successBg, text: COLORS.success, icon: "checkmark-circle" },
};

export function TodayCard({ studentId, onPress }: { studentId: string; onPress?: () => void }) {
  const [data, setData] = useState<TodayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.get<TodayStatus>(`/parent/today/${studentId}`);
        if (alive) setData(r);
      } catch {
        // silent
      } finally {
        if (alive) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, 30000); // refresh every 30s
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [studentId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }
  if (!data) return null;
  const sc = STATUS_COLOR[data.status] || STATUS_COLOR.home;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: sc.bg, borderColor: sc.text }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      testID={`today-card-${studentId}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: sc.text }]}>
          <Ionicons name={sc.icon as any} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.studentName}>{data.student.name}</Text>
          <Text style={[styles.statusLabel, { color: sc.text }]}>{data.status_label}</Text>
        </View>
        {data.events_today.length > 0 && (
          <View style={styles.eventCount}>
            <Text style={styles.eventCountText}>{data.events_today.length}</Text>
          </View>
        )}
      </View>
      {data.events_today.slice(0, 2).map((e, i) => (
        <View key={i} style={styles.eventRow}>
          <Ionicons name="ellipse" size={6} color={sc.text} style={{ marginRight: 6 }} />
          <Text style={styles.eventText} numberOfLines={1}>
            {e.title}
          </Text>
          <Text style={styles.eventTime}>
            {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      ))}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
  },
  studentName: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
  statusLabel: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  eventCount: {
    minWidth: 24, paddingHorizontal: 6, height: 22, borderRadius: 11,
    backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center",
  },
  eventCountText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  eventRow: { flexDirection: "row", alignItems: "center", marginTop: SPACING.sm },
  eventText: { flex: 1, fontSize: 12, color: COLORS.textPrimary, fontWeight: "600" },
  eventTime: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 8 },
});
