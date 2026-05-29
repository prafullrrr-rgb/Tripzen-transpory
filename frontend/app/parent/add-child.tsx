import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

export default function AddChild() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your child's name");
      return;
    }
    setSaving(true);
    try {
      await api.post("/students", {
        name: name.trim(),
        grade: grade.trim() || null,
        school: school.trim() || null,
      });
      Alert.alert("✅ Child added", `${name} has been added to your family.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Could not add", e.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Child</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          <View style={styles.heroIcon}>
            <Ionicons name="person-add" size={42} color={COLORS.accent} />
          </View>
          <Text style={styles.hero}>Add another child to your family</Text>
          <Text style={styles.heroSub}>Siblings can share one account. Each gets their own QR badge.</Text>

          <Text style={styles.label}>Child's Full Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Arjun Sharma"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            testID="input-name"
          />

          <Text style={styles.label}>Year / Grade</Text>
          <TextInput
            value={grade}
            onChangeText={setGrade}
            placeholder="e.g. Year 4"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            testID="input-grade"
          />

          <Text style={styles.label}>School</Text>
          <TextInput
            value={school}
            onChangeText={setSchool}
            placeholder="e.g. Greenfield Primary"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            testID="input-school"
          />

          <View style={styles.tip}>
            <Ionicons name="information-circle" size={18} color={COLORS.accent} />
            <Text style={styles.tipText}>
              You can assign a bus route after the school admin adds you.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={save}
            disabled={saving}
            testID="save-child-btn"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.saveText}>Add Child</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  heroIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accentLight,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: SPACING.md,
  },
  hero: { fontSize: 18, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  heroSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", marginTop: 4, marginBottom: SPACING.xl, paddingHorizontal: SPACING.md },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.primary, marginTop: SPACING.md, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tip: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: SPACING.md, padding: SPACING.sm, backgroundColor: COLORS.accentLight, borderRadius: RADIUS.sm },
  tipText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 16 },
  saveBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
