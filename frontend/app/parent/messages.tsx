import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  icon?: string;
};

const ICON_MAP: Record<string, string> = {
  boarding: "bus",
  arrival: "location",
  handover: "checkmark-circle",
  delay: "alert-circle",
  alert: "warning",
};

export default function ParentMessages() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Notification[]>("/notifications");
      setNotifications(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markRead = async (nid: string) => {
    try {
      await api.post(`/notifications/${nid}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === nid ? { ...n, read: true } : n)));
    } catch {
      // silent
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="parent-messages-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Live alerts about your child's trip</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySub}>You'll see boarding & arrival alerts here</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const icon = ICON_MAP[n.type] || "notifications";
            const isAlert = n.type === "delay" || n.type === "alert";
            return (
              <TouchableOpacity
                key={n.id}
                testID={`notif-${n.id}`}
                style={[styles.card, !n.read && { borderColor: COLORS.accent, borderWidth: 1.5 }]}
                onPress={() => markRead(n.id)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.iconBox,
                    isAlert ? { backgroundColor: COLORS.errorBg } : { backgroundColor: COLORS.accentLight },
                  ]}
                >
                  <Ionicons
                    name={icon as any}
                    size={20}
                    color={isAlert ? COLORS.error : COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{n.title}</Text>
                  <Text style={styles.message}>{n.message}</Text>
                  <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
                </View>
                {!n.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
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
    flexDirection: "row",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "flex-start",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  message: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  time: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginTop: 6,
    marginLeft: 6,
  },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: "700", color: COLORS.primary, marginTop: SPACING.sm },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
});
