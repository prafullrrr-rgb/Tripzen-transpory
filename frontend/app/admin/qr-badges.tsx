import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import QRCode from "react-native-qrcode-svg";

type Card = {
  student_id: string;
  student_name: string;
  grade?: string;
  school?: string;
  qr_code: string;
  route_name?: string;
};

export default function QRBadgesScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<{ cards: Card[] }>("/admin/students/qr-bulk")
      .then((r) => setCards(r.cards))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(new Set(cards.map((c) => c.student_id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handlePrint = () => {
    const count = selected.size || cards.length;
    Alert.alert(
      "🖨️ Print badges",
      `Ready to print ${count} QR badge${count > 1 ? "s" : ""}.\n\nOn iPhone: tap Share → Print. On Mac/PC: use browser print.\n\nEach badge fits 4 per A4 page.`,
      [{ text: "Got it" }]
    );
    if (typeof window !== "undefined" && (window as any).print) {
      setTimeout(() => (window as any).print(), 300);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const visibleCards = selected.size > 0
    ? cards.filter((c) => selected.has(c.student_id))
    : cards;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>QR Badges</Text>
        <TouchableOpacity onPress={handlePrint}>
          <Ionicons name="print" size={26} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.toolbarText}>
          {selected.size > 0 ? `${selected.size} selected` : `${cards.length} students`}
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {selected.size > 0 ? (
            <TouchableOpacity onPress={clearSelection}>
              <Text style={styles.toolbarBtn}>Clear</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={selectAll}>
              <Text style={styles.toolbarBtn}>Select All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }}>
        <View style={styles.grid}>
          {visibleCards.map((c) => (
            <TouchableOpacity
              key={c.student_id}
              style={[styles.badge, selected.has(c.student_id) && styles.badgeSelected]}
              onPress={() => toggleSelect(c.student_id)}
              activeOpacity={0.85}
              testID={`qr-badge-${c.student_id}`}
            >
              <View style={styles.badgeHeader}>
                <Text style={styles.badgeBrand}>TripZen</Text>
                <Ionicons
                  name={selected.has(c.student_id) ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={selected.has(c.student_id) ? COLORS.success : COLORS.textSecondary}
                />
              </View>
              <View style={styles.qrBox}>
                <QRCode
                  value={c.qr_code || c.student_id}
                  size={108}
                  backgroundColor="#fff"
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.studentName} numberOfLines={2}>{c.student_name}</Text>
              {c.grade ? <Text style={styles.studentMeta}>Year {c.grade}</Text> : null}
              {c.route_name ? <Text style={styles.studentMeta}>{c.route_name}</Text> : null}
              <Text style={styles.qrText}>{c.qr_code}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.note}>
          💡 Tap to select. Print selected only, or print all.
          {"\n"}Each badge is 70 × 100 mm — fits 8 per A4 sheet.
        </Text>
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.accentLight,
  },
  toolbarText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  toolbarBtn: { fontSize: 13, color: COLORS.accent, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  badge: {
    width: "48%",
    backgroundColor: "#fff",
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  badgeSelected: { borderColor: COLORS.success, borderWidth: 2 },
  badgeHeader: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  badgeBrand: { fontSize: 11, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },
  qrBox: { padding: 8, backgroundColor: "#fff", borderRadius: 8, marginVertical: 6 },
  studentName: { fontSize: 12, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  studentMeta: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  qrText: { fontSize: 9, fontFamily: "monospace", color: COLORS.textSecondary, marginTop: 4 },
  note: { fontSize: 11, color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.md, lineHeight: 16 },
});
