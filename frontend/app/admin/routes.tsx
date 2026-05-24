import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Route = {
  id: string;
  name: string;
  bus_number?: string;
  shift: string;
  student_count: number;
  stops: { id: string; name: string; lat: number; lng: number; order: number; eta?: string }[];
  driver_id?: string;
};

type Driver = { id: string; full_name: string; email: string; role: string };

export default function ManageRoutes() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [shift, setShift] = useState<"morning" | "afternoon">("morning");
  const [driverId, setDriverId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([
        api.get<Route[]>("/routes"),
        api.get<Driver[]>("/admin/users"),
      ]);
      setRoutes(r);
      setDrivers(u.filter((x) => x.role === "driver"));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditId(null);
    setName("");
    setBusNumber("");
    setShift("morning");
    setDriverId(drivers[0]?.id || "");
    setModalOpen(true);
  };

  const openEdit = (r: Route) => {
    setEditId(r.id);
    setName(r.name);
    setBusNumber(r.bus_number || "");
    setShift((r.shift as any) || "morning");
    setDriverId(r.driver_id || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing", "Route name is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        bus_number: busNumber.trim() || undefined,
        shift,
        driver_id: driverId || undefined,
        stops: [],
      };
      if (editId) {
        await api.put(`/routes/${editId}`, body);
      } else {
        await api.post("/routes", body);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: Route) => {
    const doDelete = async () => {
      try {
        await api.delete(`/routes/${r.id}`);
        await load();
      } catch (e: any) {
        Alert.alert("Delete failed", e.message);
      }
    };
    if (Platform.OS === "web") {
      doDelete();
      return;
    }
    Alert.alert("Delete route?", `"${r.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top"]} testID="manage-routes-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="routes-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Routes</Text>
          <TouchableOpacity onPress={openCreate} testID="add-route-btn" style={styles.addBtn}>
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
          ) : routes.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={42} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No routes yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
                <Text style={styles.emptyBtnText}>+ Create Route</Text>
              </TouchableOpacity>
            </View>
          ) : (
            routes.map((r) => {
              const driver = drivers.find((d) => d.id === r.driver_id);
              return (
                <View key={r.id} style={styles.card} testID={`route-row-${r.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.name}</Text>
                    <Text style={styles.cardMeta}>
                      {r.bus_number || "No bus"} • {r.shift} • {r.stops.length} stops •{" "}
                      {r.student_count} students
                    </Text>
                    <Text style={styles.cardSub}>
                      Driver: {driver?.full_name || "Unassigned"}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      testID={`edit-route-${r.id}`}
                      style={styles.iconBtn}
                      onPress={() => openEdit(r)}
                    >
                      <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`delete-route-${r.id}`}
                      style={styles.iconBtnDanger}
                      onPress={() => handleDelete(r)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editId ? "Edit Route" : "New Route"}</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)} testID="close-modal-btn">
                  <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
                <Text style={styles.label}>Route name</Text>
                <TextInput
                  testID="route-name-input"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Route 4 - Morning"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.label}>Bus number</Text>
                <TextInput
                  testID="route-bus-input"
                  style={styles.input}
                  value={busNumber}
                  onChangeText={setBusNumber}
                  placeholder="Bus 4"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.label}>Shift</Text>
                <View style={styles.segRow}>
                  {(["morning", "afternoon"] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      testID={`shift-${s}`}
                      style={[styles.segBtn, shift === s && styles.segBtnActive]}
                      onPress={() => setShift(s)}
                    >
                      <Text
                        style={[styles.segText, shift === s && { color: COLORS.primary, fontWeight: "800" }]}
                      >
                        {s === "morning" ? "🌅 Morning" : "🌆 Afternoon"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Driver</Text>
                {drivers.length === 0 ? (
                  <Text style={styles.helper}>No drivers yet. Create one from Manage Drivers.</Text>
                ) : (
                  drivers.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      testID={`driver-opt-${d.id}`}
                      style={[styles.driverRow, driverId === d.id && styles.driverRowActive]}
                      onPress={() => setDriverId(d.id)}
                    >
                      <Ionicons
                        name={driverId === d.id ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={driverId === d.id ? COLORS.accent : COLORS.textSecondary}
                      />
                      <Text style={styles.driverName}>{d.full_name}</Text>
                    </TouchableOpacity>
                  ))
                )}

                <TouchableOpacity
                  testID="save-route-btn"
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Text style={styles.saveBtnText}>{editId ? "Save Changes" : "Create Route"}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
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
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  cardSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  actions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.errorBg,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptyBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  emptyBtnText: { color: COLORS.primary, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 27, 61, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segRow: { flexDirection: "row", gap: SPACING.sm },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSecondary,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  segBtnActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  segText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },
  helper: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  driverRowActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  driverName: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  saveBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  saveBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
});
