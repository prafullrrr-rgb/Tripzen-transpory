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
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type User = { id: string; email: string; full_name: string; role: string; phone?: string };

export default function ManageDrivers() {
  const router = useRouter();
  const { user: me } = useAuth();
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await api.get<User[]>("/admin/users");
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
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Missing", "Name, email and password are required");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/users", {
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        role: "driver",
      });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Create failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (d: User) => {
    if (d.id === me?.id) return;
    const doDelete = async () => {
      try {
        await api.delete(`/admin/users/${d.id}`);
        await load();
      } catch (e: any) {
        Alert.alert("Delete failed", e.message);
      }
    };
    if (Platform.OS === "web") {
      doDelete();
      return;
    }
    Alert.alert("Delete driver?", `"${d.full_name}" will be removed.`, [
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
      <SafeAreaView style={styles.safe} edges={["top"]} testID="manage-drivers-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="drivers-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Drivers</Text>
          <TouchableOpacity onPress={openCreate} testID="add-driver-btn" style={styles.addBtn}>
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
          ) : drivers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="car-sport-outline" size={42} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No drivers yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
                <Text style={styles.emptyBtnText}>+ Add Driver</Text>
              </TouchableOpacity>
            </View>
          ) : (
            drivers.map((d) => (
              <View key={d.id} style={styles.card} testID={`driver-row-${d.id}`}>
                <View style={styles.iconCircle}>
                  <Ionicons name="person" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{d.full_name}</Text>
                  <Text style={styles.cardMeta}>{d.email}</Text>
                  {d.phone && <Text style={styles.cardMeta}>{d.phone}</Text>}
                </View>
                <TouchableOpacity
                  testID={`delete-driver-${d.id}`}
                  style={styles.iconBtnDanger}
                  onPress={() => handleDelete(d)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
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
                <Text style={styles.modalTitle}>New Driver</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)} testID="close-driver-modal">
                  <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  testID="driver-name-input"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="John Smith"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.label}>Email</Text>
                <TextInput
                  testID="driver-email-input"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="driver@tripzen.com"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Phone (optional)</Text>
                <TextInput
                  testID="driver-phone-input"
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+44 7700 900000"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                />
                <Text style={styles.label}>Initial password</Text>
                <TextInput
                  testID="driver-password-input"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                />

                <TouchableOpacity
                  testID="save-driver-btn"
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Text style={styles.saveBtnText}>Create Driver</Text>
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
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 27, 61, 0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
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
  saveBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  saveBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
});
