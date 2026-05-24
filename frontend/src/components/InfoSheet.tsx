import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

export type InfoBullet = { icon?: string; title: string; body?: string };

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  bullets?: InfoBullet[];
  body?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}

export default function InfoSheet({
  visible,
  onClose,
  icon,
  iconColor,
  title,
  subtitle,
  bullets,
  body,
  primaryLabel,
  onPrimary,
}: InfoSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: (iconColor || COLORS.accent) + "22" }]}>
              <Ionicons name={icon as any} size={22} color={iconColor || COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} testID="info-sheet-close" hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {body ? <Text style={styles.body}>{body}</Text> : null}
            {bullets?.map((b, i) => (
              <View key={i} style={styles.bullet}>
                {b.icon ? (
                  <Ionicons name={b.icon as any} size={18} color={COLORS.accent} style={{ marginRight: 10, marginTop: 1 }} />
                ) : (
                  <View style={styles.dot} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bulletTitle}>{b.title}</Text>
                  {b.body ? <Text style={styles.bulletBody}>{b.body}</Text> : null}
                </View>
              </View>
            ))}
          </ScrollView>

          {primaryLabel ? (
            <TouchableOpacity
              testID="info-sheet-primary"
              style={styles.primaryBtn}
              onPress={() => {
                onPrimary?.();
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="info-sheet-dismiss"
              style={styles.dismissBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.dismissBtnText}>Got it</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15, 27, 61, 0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 24,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: SPACING.md },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  body: { fontSize: 14, color: COLORS.primary, lineHeight: 21, marginBottom: SPACING.sm },
  bullet: { flexDirection: "row", paddingVertical: 8, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginTop: 8, marginRight: 12 },
  bulletTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },
  bulletBody: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  primaryBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
  dismissBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgSecondary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dismissBtnText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
});
