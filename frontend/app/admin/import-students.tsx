import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

export default function ImportStudents() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("name,grade,school\nAarav Sharma,Year 4,Greenfield Primary\nLeena Khan,Year 2,Oakwood");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ count: number; errors?: any[] } | null>(null);

  const upload = async () => {
    if (!csvText.trim()) {
      Alert.alert("Empty CSV", "Paste at least one row of data");
      return;
    }
    setUploading(true);
    try {
      // Send as multipart upload via fetch directly (api.post may not handle FormData)
      const baseUrl = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
      const blob = new Blob([csvText], { type: "text/csv" });
      const form = new FormData();
      form.append("file", blob as any, "students.csv");
      const tokenRes = await api.get<{ id: string; email: string }>("/auth/me").catch(() => null);
      if (!tokenRes) {
        Alert.alert("Not authenticated");
        return;
      }
      // use api client's underlying fetch instead - simpler: call admin/students/import with raw form
      // For simplicity, call POST endpoint by passing FormData via api.post:
      const res: any = await (api as any).postForm
        ? (api as any).postForm("/admin/students/import", form)
        : await fetch(`${baseUrl}/api/admin/students/import`, {
            method: "POST",
            body: form,
            headers: { Authorization: `Bearer ${(api as any).getToken?.() || ""}` },
          }).then((r) => r.json());
      setResult(res);
      Alert.alert("✅ Imported", `${res.count} students added to your school.`);
    } catch (e: any) {
      Alert.alert("Import failed", e.message || "Check CSV format");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Bulk Import Students</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 80 }}>
          <View style={styles.heroBox}>
            <Ionicons name="cloud-upload" size={42} color={COLORS.accent} />
            <Text style={styles.heroTitle}>CSV Bulk Upload</Text>
            <Text style={styles.heroSub}>
              Paste CSV with header row: name, grade, school. Each row creates a student
              with auto-generated QR badge.
            </Text>
          </View>

          <Text style={styles.label}>CSV Content</Text>
          <TextInput
            value={csvText}
            onChangeText={setCsvText}
            placeholder="name,grade,school\nJohn Doe,Year 3,Oakwood"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.csvInput}
            multiline
            testID="csv-input"
          />

          <View style={styles.formatBox}>
            <Text style={styles.formatTitle}>✅ Required CSV Format:</Text>
            <Text style={styles.formatText}>
              First row must be header: <Text style={styles.code}>name,grade,school</Text>
            </Text>
            <Text style={styles.formatText}>
              Each next row = one student. The grade and school fields are optional.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.uploadBtn, uploading && { opacity: 0.5 }]}
            onPress={upload}
            disabled={uploading}
            testID="upload-btn"
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.uploadText}>Import Students</Text>
              </>
            )}
          </TouchableOpacity>

          {result && (
            <View style={styles.resultBox}>
              <Ionicons name="checkmark-circle" size={32} color={COLORS.success} />
              <Text style={styles.resultTitle}>{result.count} students imported</Text>
              <Text style={styles.resultSub}>
                Visit Print QR Badges to generate boarding badges.
              </Text>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => router.push("/admin/qr-badges")}
              >
                <Text style={styles.linkText}>→ Print QR Badges</Text>
              </TouchableOpacity>
            </View>
          )}
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
  heroBox: { alignItems: "center", marginBottom: SPACING.lg },
  heroTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary, marginTop: SPACING.sm },
  heroSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 18, paddingHorizontal: SPACING.md },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.primary, marginTop: SPACING.md, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  csvInput: {
    backgroundColor: "#1a1a1a",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    color: "#00ff00",
    minHeight: 160,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formatBox: { backgroundColor: COLORS.accentLight, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md },
  formatTitle: { fontSize: 13, fontWeight: "800", color: COLORS.primary, marginBottom: 6 },
  formatText: { fontSize: 12, color: COLORS.textPrimary, marginVertical: 2, lineHeight: 17 },
  code: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }), backgroundColor: COLORS.bg, paddingHorizontal: 4, borderRadius: 4 },
  uploadBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  resultBox: { alignItems: "center", padding: SPACING.lg, backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, marginTop: SPACING.md },
  resultTitle: { fontSize: 16, fontWeight: "800", color: COLORS.success, marginTop: SPACING.sm },
  resultSub: { fontSize: 12, color: COLORS.textSecondary, textAlign: "center", marginTop: 4 },
  linkBtn: { marginTop: SPACING.md, padding: SPACING.sm },
  linkText: { fontSize: 14, fontWeight: "800", color: COLORS.accent },
});
