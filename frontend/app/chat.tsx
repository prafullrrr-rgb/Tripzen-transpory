import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

type Msg = { id: string; from_id: string; to_id: string; text: string; created_at: string; read: boolean };
type Other = { id: string; full_name: string; role: string };

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ other_id?: string; other_name?: string }>();
  const otherId = params.other_id || "";
  const otherName = params.other_name || "Conversation";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!otherId) return;
    try {
      const m = await api.get<Msg[]>(`/messages/${otherId}`);
      setMessages(m);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [otherId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    if (!text.trim() || !otherId) return;
    setSending(true);
    const draft = text.trim();
    setText("");
    try {
      await api.post("/messages", { recipient_id: otherId, text: draft });
      await load();
    } catch (e: any) {
      Alert.alert("Send failed", e.message);
      setText(draft);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="chat-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="chat-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{otherName}</Text>
            <Text style={styles.subtitle}>End-to-end secure</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={18} color={COLORS.primary} />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 12 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
            ) : messages.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={42} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Start the conversation</Text>
                <Text style={styles.emptySub}>Say hi to {otherName}</Text>
              </View>
            ) : (
              messages.map((m) => {
                const mine = m.from_id === user?.id;
                return (
                  <View
                    key={m.id}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                    testID={`msg-${m.id}`}
                  >
                    <Text style={[styles.bubbleText, mine && { color: COLORS.primary }]}>{m.text}</Text>
                    <Text style={[styles.time, mine && { color: COLORS.primary, opacity: 0.6 }]}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              testID="chat-input"
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              testID="chat-send-btn"
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
              onPress={send}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
  subtitle: { fontSize: 11, color: COLORS.success, marginTop: 2 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: "700", color: COLORS.primary, marginTop: SPACING.md },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  bubble: {
    maxWidth: "78%",
    padding: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.bg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: { fontSize: 14, color: COLORS.primary },
  time: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4, alignSelf: "flex-end" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: SPACING.md,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
