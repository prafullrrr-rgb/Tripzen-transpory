import { useEffect, useState } from "react";
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

type Template = { id: string; title: string; body: string; icon: string };

export default function AdminBroadcast() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ templates: Template[] }>("/admin/broadcast/templates")
      .then((r) => setTemplates(r.templates))
      .finally(() => setLoading(false));
  }, []);

  const send = async (tplId: string | null) => {
    const isCustom = !tplId;
    if (isCustom && (!customTitle.trim() || !customBody.trim())) {
      Alert.alert("Missing fields", "Please enter a title and message.");
      return;
    }
    Alert.alert(
      "Send to all parents?",
      isCustom ? `"${customTitle}"` : selected?.title || "",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Now",
          onPress: async () => {
            setSending(true);
            try {
              const res: any = await api.post("/admin/broadcast",
                isCustom
                  ? { title: customTitle, body: customBody, icon: "megaphone" }
                  : { template_id: tplId }
              );
              Alert.alert("✅ Sent", `Notified ${res.sent} parents`);
              setSelected(null);
              setCustomTitle("");
              setCustomBody("");
            } catch (e: any) {
              Alert.alert("Failed", e.message || "Try again");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Broadcast Message</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 80 }}>
          <Text style={styles.sectionTitle}>Quick Templates</Text>
          <Text style={styles.sectionSub}>Tap to send to all parents instantly</Text>

          {templates.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tplCard, selected?.id === t.id && styles.tplCardActive]}
              onPress={() => setSelected(t)}
              testID={`template-${t.id}`}
            >
              <View style={styles.tplIcon}>
                <Ionicons name={t.icon as any} size={22} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tplTitle}>{t.title}</Text>
                <Text style={styles.tplBody} numberOfLines={2}>{t.body}</Text>
              </View>
              <Ionicons
                name={selected?.id === t.id ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={selected?.id === t.id ? COLORS.accent : COLORS.textSecondary}
              />
            </TouchableOpacity>
          ))}

          {selected && (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => send(selected.id)}
              disabled={sending}
              testID="send-template-btn"
            >
              {sending ? (
                <ActivityIndicator color={"#fff"} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.sendText}>Send “{selected.title.slice(0, 30)}…”</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Custom Message</Text>
          <Text style={styles.sectionSub}>Write your own broadcast</Text>

          <TextInput
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder="Title (e.g. Half-term notice)"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            testID="custom-title-input"
          />
          <TextInput
            value={customBody}
            onChangeText={setCustomBody}
            placeholder="Message body"
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.input, { height: 110, textAlignVertical: "top" }]}
            multiline
            testID="custom-body-input"
          />

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => send(null)}
            disabled={sending}
            testID="send-custom-btn"
          >
            {sending ? (
              <ActivityIndicator color={"#fff"} />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.sendText}>Send Custom Message</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            Tip: All parents will receive a push notification + in-app alert.
          </Text>
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
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.primary, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  tplCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  tplCardActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  tplIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  tplTitle: { fontSize: 14, fontWeight: "800", color: COLORS.primary },
  tplBody: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xl },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  note: { fontSize: 11, color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.md },
});
