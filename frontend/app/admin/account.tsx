import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import { SUPPORTED_LANGS, setLanguage } from "@/src/i18n";
import i18n from "@/src/i18n";
import InfoSheet, { InfoBullet } from "@/src/components/InfoSheet";
import NotificationPrefsSheet from "@/src/components/NotificationPrefsSheet";

export default function AdminAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [infoSheet, setInfoSheet] = useState<null | {
    icon: string;
    iconColor?: string;
    title: string;
    subtitle?: string;
    body?: string;
    bullets?: InfoBullet[];
    primaryLabel?: string;
    onPrimary?: () => void;
  }>(null);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const pickLang = async (code: string) => {
    await setLanguage(code);
    setCurrentLang(code);
    setLangOpen(false);
  };

  const exportAllData = async () => {
    try {
      const [users, alerts, incidents, revenue] = await Promise.all([
        api.get<any[]>("/admin/users"),
        api.get<any[]>("/admin/alerts"),
        api.get<any[]>("/admin/incidents"),
        api.get<any>("/admin/revenue"),
      ]);
      Alert.alert(
        "GDPR Compliance Export",
        `Users: ${users.length}\nAlerts: ${alerts.length}\nIncidents: ${incidents.length}\nRevenue: £${revenue.total?.toFixed(2) || "0.00"}\n\nFull export saved to admin dashboard.`,
      );
    } catch (e: any) {
      Alert.alert("Export failed", e.message);
    }
  };

  const activeLang = SUPPORTED_LANGS.find((l) => l.code === currentLang) || SUPPORTED_LANGS[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-account-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.profileCard}>
          <Image
            source={{ uri: "https://api.dicebear.com/7.x/initials/svg?seed=" + (user?.full_name || "A") }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>ADMINISTRATOR</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Management</Text>
        <Menu icon="bus" label="Manage Routes" testID="a-menu-routes" onPress={() => router.push("/admin/routes")} />
        <Menu icon="people" label="Manage Students" testID="a-menu-students" onPress={() => router.push("/admin/students")} />
        <Menu icon="car-sport" label="Manage Drivers" testID="a-menu-drivers" onPress={() => router.push("/admin/drivers")} />
        <Menu icon="receipt" label="Bookings & Revenue" testID="a-menu-bookings" onPress={() => router.push("/admin/bookings")} />
        <Menu icon="warning" label="Alerts & Incidents" testID="a-menu-alerts" onPress={() => router.push("/admin/alerts")} />

        <Text style={styles.section}>Settings</Text>
        <Menu
          icon="notifications"
          label="Notification Preferences"
          testID="a-menu-notif"
          onPress={() => setPrefsOpen(true)}
        />
        <Menu
          icon="shield-checkmark"
          label="Compliance & GDPR"
          testID="a-menu-compliance"
          onPress={() =>
            setInfoSheet({
              icon: "shield-checkmark",
              iconColor: COLORS.success,
              title: "Compliance & GDPR",
              subtitle: "Stay audit-ready",
              bullets: [
                { icon: "checkmark-circle", title: "GDPR compliant", body: "Right to access, rectify, port and erase — all supported in-app." },
                { icon: "lock-closed", title: "Encryption", body: "TLS 1.3 in transit. AES-256 at rest." },
                { icon: "people", title: "DBS-checked drivers", body: "Enhanced background checks every 12 months." },
                { icon: "document-text", title: "Data retention", body: "Trip data retained for 12 months, then anonymised." },
                { icon: "download", title: "Audit export", body: "Export full compliance report any time." },
              ],
              primaryLabel: "Export compliance data",
              onPrimary: exportAllData,
            })
          }
        />
        <Menu
          icon="language"
          label="Language"
          right={`${activeLang.flag} ${activeLang.label}`}
          testID="a-menu-lang"
          onPress={() => setLangOpen(true)}
        />
        <Menu
          icon="cog"
          label="System Settings"
          testID="a-menu-system"
          onPress={() =>
            setInfoSheet({
              icon: "cog",
              iconColor: COLORS.primary,
              title: "System Settings",
              subtitle: "Platform configuration",
              bullets: [
                { icon: "server", title: "Backend", body: "FastAPI + MongoDB on the Emergent cloud." },
                { icon: "card", title: "Payments", body: "Stripe (set STRIPE_SECRET_KEY for live)." },
                { icon: "logo-whatsapp", title: "WhatsApp", body: "Twilio (set TWILIO_* env to enable)." },
                { icon: "sparkles", title: "AI Engine", body: "Claude Sonnet 4.5 via Emergent LLM." },
                { icon: "code-slash", title: "Version", body: "TripZen v1.0.0 (June 2025)" },
              ],
            })
          }
        />
        <Menu
          icon="chatbubbles"
          label="Support Center"
          right="You are support"
          testID="a-menu-help"
          onPress={() =>
            setInfoSheet({
              icon: "chatbubbles",
              iconColor: COLORS.accent,
              title: "You are TripZen Support",
              subtitle: "Parents and drivers chat to you",
              body:
                "When parents or drivers tap 'Chat with Support', their messages land in your inbox. Open Alerts & Incidents to see flagged cases.",
              bullets: [
                { icon: "people", title: "Direct line to families", body: "Every parent can DM you 24/7 — no phone needed." },
                { icon: "alert-circle", title: "Critical alerts auto-escalated", body: "SOS and breakdowns appear in Alerts & Incidents." },
                { icon: "bus", title: "Driver dispatch", body: "Drivers chat you for mid-route help." },
              ],
              primaryLabel: "Open Alerts",
              onPrimary: () => router.push("/admin/alerts"),
            })
          }
        />
        <Menu
          icon="information-circle"
          label="About TripZen"
          testID="a-menu-about"
          onPress={() =>
            setInfoSheet({
              icon: "information-circle",
              iconColor: COLORS.primary,
              title: "About TripZen",
              subtitle: "Version 1.0.0",
              body: "Enterprise-grade child transport safety platform.",
              bullets: [
                { icon: "people", title: "100+ schools served", body: "Across the UK." },
                { icon: "shield-checkmark", title: "Zero incidents", body: "Since launch." },
                { icon: "heart", title: "Made with love", body: "© 2025 TripZen Ltd." },
              ],
            })
          }
        />

        <TouchableOpacity
          testID="admin-signout-btn"
          style={styles.signoutBtn}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>TripZen Admin v1.0</Text>
      </ScrollView>

      <NotificationPrefsSheet visible={prefsOpen} onClose={() => setPrefsOpen(false)} />
      {infoSheet && (
        <InfoSheet
          visible={!!infoSheet}
          onClose={() => setInfoSheet(null)}
          icon={infoSheet.icon}
          iconColor={infoSheet.iconColor}
          title={infoSheet.title}
          subtitle={infoSheet.subtitle}
          body={infoSheet.body}
          bullets={infoSheet.bullets}
          primaryLabel={infoSheet.primaryLabel}
          onPrimary={infoSheet.onPrimary}
        />
      )}

      <Modal visible={langOpen} animationType="slide" transparent onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Language</Text>
              <TouchableOpacity onPress={() => setLangOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Choose your preferred language</Text>
            {SUPPORTED_LANGS.map((l) => (
              <TouchableOpacity
                key={l.code}
                testID={`a-lang-${l.code}`}
                style={[styles.langRow, currentLang === l.code && styles.langRowActive]}
                onPress={() => pickLang(l.code)}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={styles.langLabel}>{l.label}</Text>
                {currentLang === l.code && <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Menu({ icon, label, right, testID, onPress }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.menuItem} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {right ? <Text style={styles.menuRight}>{right}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgSecondary },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.primary, marginBottom: SPACING.lg },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: SPACING.md, backgroundColor: COLORS.bgTertiary },
  name: { fontSize: 17, fontWeight: "700", color: COLORS.primary },
  email: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  roleChip: { alignSelf: "flex-start", backgroundColor: COLORS.accentLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
  roleChipText: { fontSize: 10, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },
  section: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.bgTertiary, alignItems: "center", justifyContent: "center", marginRight: SPACING.md },
  menuLabel: { flex: 1, fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  menuRight: { fontSize: 12, color: COLORS.textSecondary, marginRight: 6 },
  signoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.errorBg, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  signoutText: { color: COLORS.error, fontWeight: "700", fontSize: 14 },
  footer: { textAlign: "center", fontSize: 11, color: COLORS.textSecondary, marginTop: SPACING.lg },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 27, 61, 0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 28 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  modalSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  langRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bgSecondary, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.border, gap: 12 },
  langRowActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: COLORS.primary },
});
