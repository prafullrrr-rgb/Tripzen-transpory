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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
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
  parent_id: string;
};

type Route = { id: string; name: string };
type User = { id: string; full_name: string; role: string };

export default function ManageStudents() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [parents, setParents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [routeId, setRouteId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r, u] = await Promise.all([
        api.get<Student[]>("/students"),
        api.get<Route[]>("/routes"),
        api.get<User[]>("/admin/users"),
      ]);
      setStudents(s);
      setRoutes(r);
      setParents(u.filter((x) => x.role === "parent"));
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
    setGrade("");
    setSchool("");
    setRouteId(routes[0]?.id || "");
    setModalOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditId(s.id);
    setName(s.name);
    setGrade(s.grade || "");
    setSchool(s.school || "");
    setRouteId(s.route_id || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing", "Student name is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        grade: grade.trim() || undefined,
        school: school.trim() || undefined,
        route_id: routeId || undefined,
      };
      if (editId) {
        await api.put(`/students/${editId}`, body);
      } else {
        await api.post("/students", body);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: Student) => {
    const doDelete = async () => {
      try {
        await api.delete(`/students/${s.id}`);
        await load();
      } catch (e: any) {
        Alert.alert("Delete failed", e.message);
      }
    };
    if (Platform.OS === "web") {
      doDelete();
      return;
    }
    Alert.alert("Delete student?", `"${s.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const findParent = (pid: string) => parents.find((p) => p.id === pid);
  const findRoute = (rid?: string) => routes.find((r) => r.id === rid);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top"]} testID="manage-students-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="students-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Students</Text>
          <TouchableOpacity onPress={openCreate} testID="add-student-btn" style={styles.addBtn}>
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
          ) : students.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={42} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No students yet</Text>
            </View>
          ) : (
            students.map((s) => (
              <View key={s.id} style={styles.card} testID={`student-row-${s.id}`}>
                <Image
                  source={{
                    uri:
                      s.avatar_url ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`,
                  }}
                  style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{s.name}</Text>
                  <Text style={styles.cardMeta}>
                    {s.grade || "—"} • {s.school || "—"}
                  </Text>
                  <Text style={styles.cardSub}>
                    Route: {findRoute(s.route_id)?.name || "Unassigned"} • Parent:{" "}
                    {findParent(s.parent_id)?.full_name || "—"}
                  </Text>
                  <View style={styles.qrChip}>
                    <Ionicons name="qr-code" size={11} color={COLORS.primary} />
                    <Text style={styles.qrChipText}>{s.qr_code}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    testID={`edit-student-${s.id}`}
                    style={styles.iconBtn}
                    onPress={() => openEdit(s)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`delete-student-${s.id}`}
                    style={styles.iconBtnDanger}
                    onPress={() => handleDelete(s)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editId ? "Edit Student" : "New Student"}</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)} testID="close-student-modal">
                  <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  testID="student-name-input"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Aarav Sharma"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.label}>Grade</Text>
                <TextInput
                  testID="student-grade-input"
                  style={styles.input}
                  value={grade}
                  onChangeText={setGrade}
                  placeholder="Year 4"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.label}>School</Text>
                <TextInput
                  testID="student-school-input"
                  style={styles.input}
                  value={school}
                  onChangeText={setSchool}
                  placeholder="Greenfield School"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.label}>Route</Text>
                {routes.length === 0 ? (
                  <Text style={styles.helper}>No routes yet. Create one first.</Text>
                ) : (
                  routes.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      testID={`stud-route-opt-${r.id}`}
                      style={[styles.optRow, routeId === r.id && styles.optRowActive]}
                      onPress={() => setRouteId(r.id)}
                    >
                      <Ionicons
                        name={routeId === r.id ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={routeId === r.id ? COLORS.accent : COLORS.textSecondary}
                      />
                      <Text style={styles.optName}>{r.name}</Text>
                    </TouchableOpacity>
                  ))
                )}

                <TouchableOpacity
                  testID="save-student-btn"
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editId ? "Save Changes" : "Create Student"}
                    </Text>
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
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: SPACING.md, backgroundColor: COLORS.bgTertiary },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  cardMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cardSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  qrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 5,
  },
  qrChipText: { fontSize: 9, fontWeight: "800", color: COLORS.primary },
  actions: { gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.errorBg,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm },
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
  helper: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 },
  optRow: {
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
  optRowActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  optName: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  saveBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  saveBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
});
