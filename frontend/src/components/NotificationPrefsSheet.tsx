import { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

const KEY = "tz_notif_prefs";

type Prefs = {
  push: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  boarding: boolean;
  checkout: boolean;
  sos: boolean;
  delays: boolean;
};

const DEFAULTS: Prefs = {
  push: true,
  email: true,
  sms: false,
  whatsapp: false,
  boarding: true,
  checkout: true,
  sos: true,
  delays: true,
};

export default function NotificationPrefsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {
        // ignore
      }
      setLoading(false);
    })();
  }, [visible]);

  const update = async (k: keyof Prefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const save = async () => {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
      Alert.alert("Saved", "Notification preferences updated.");
      onClose();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="notifications" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.title}>Notification Preferences</Text>
            <TouchableOpacity onPress={onClose} testID="prefs-close" hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {!loading && (
            <>
              <Text style={styles.sectionLabel}>Channels</Text>
              <Row icon="phone-portrait" label="Push notifications" value={prefs.push} onChange={(v) => update("push", v)} testID="pref-push" />
              <Row icon="mail" label="Email" value={prefs.email} onChange={(v) => update("email", v)} testID="pref-email" />
              <Row icon="chatbox" label="SMS" value={prefs.sms} onChange={(v) => update("sms", v)} testID="pref-sms" />
              <Row icon="logo-whatsapp" label="WhatsApp" value={prefs.whatsapp} onChange={(v) => update("whatsapp", v)} testID="pref-whatsapp" />

              <Text style={styles.sectionLabel}>Events</Text>
              <Row icon="bus" label="Child boards bus" value={prefs.boarding} onChange={(v) => update("boarding", v)} testID="pref-board" />
              <Row icon="exit" label="Drop-off / check-out" value={prefs.checkout} onChange={(v) => update("checkout", v)} testID="pref-checkout" />
              <Row icon="warning" label="SOS / Emergency" value={prefs.sos} onChange={(v) => update("sos", v)} testID="pref-sos" />
              <Row icon="time" label="Delays & incidents" value={prefs.delays} onChange={(v) => update("delays", v)} testID="pref-delays" />
            </>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85} testID="prefs-save">
            <Text style={styles.saveText}>Save preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  value,
  onChange,
  testID,
}: {
  icon: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={COLORS.primary} style={{ width: 22 }} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.accent }}
        thumbColor={COLORS.bg}
      />
    </View>
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: SPACING.sm },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accentLight },
  title: { flex: 1, fontSize: 17, fontWeight: "800", color: COLORS.primary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: SPACING.md,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.primary },
  saveBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  saveText: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
});
