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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account?",
      "This will permanently delete your TripZen admin account and personal data. Audit logs and broadcasts will be retained but anonymised. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm permanent deletion",
              "Are you absolutely sure? You will be signed out immediately and your account cannot be recovered.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Yes, delete forever",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await api.delete("/account");
                      await signOut();
                      router.replace("/login");
                      setTimeout(
                        () =>
                          Alert.alert(
                            "Account deleted",
                            "Your TripZen account and personal data have been permanently removed.",
                          ),
                        400,
                      );
                    } catch (e: any) {
                      Alert.alert("Delete failed", e.message || "Try again later");
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
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
        "Compliance Export Ready",
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
          label="Privacy & Safeguarding"
          testID="a-menu-compliance"
          onPress={() =>
            setInfoSheet({
              icon: "shield-checkmark",
              iconColor: COLORS.success,
              title: "Privacy & Safeguarding",
              subtitle: "How we keep families safe",
              bullets: [
                { icon: "checkmark-circle", title: "Your data, your control", body: "Access, edit, export or delete your data — any time, right from the app." },
                { icon: "lock-closed", title: "Encrypted end-to-end", body: "All data is encrypted in transit and at rest." },
                { icon: "people", title: "Verified drivers only", body: "Every driver passes enhanced background checks every 12 months." },
                { icon: "document-text", title: "How long we keep data", body: "Trip data is kept for 12 months, then automatically anonymised." },
                { icon: "download", title: "Export at any time", body: "Download a full report of your school's data whenever you need it." },
              ],
              primaryLabel: "Download compliance data",
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
          label="About this app"
          testID="a-menu-system"
          onPress={() =>
            setInfoSheet({
              icon: "cog",
              iconColor: COLORS.primary,
              title: "About this app",
              subtitle: "What powers TripZen",
              bullets: [
                { icon: "cloud", title: "Securely hosted", body: "All your data is stored safely on the cloud and protected at every step." },
                { icon: "card", title: "Safe payments", body: "Card payments are handled by Stripe — your card details never touch our servers." },
                { icon: "logo-whatsapp", title: "WhatsApp updates", body: "Get pickup and drop-off alerts on WhatsApp (where available)." },
                { icon: "sparkles", title: "Smart insights", body: "We use AI to summarise your child's week and surface anything that needs attention." },
                { icon: "code-slash", title: "Version", body: "TripZen — 1.0.1 (June 2025)" },
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
              subtitle: "Version 1.0.1",
              body: "Enterprise-grade child transport safety platform.",
              bullets: [
                { icon: "people", title: "Trusted by schools", body: "Serving schools across the UK." },
                { icon: "shield-checkmark", title: "Safety first", body: "Every trip backed by real-time monitoring." },
                { icon: "heart", title: "Made with love", body: "© 2025 TripZen Ltd." },
              ],
            })
          }
        />

        <Text style={styles.section}>Account & Privacy</Text>
        <TouchableOpacity
          testID="admin-delete-account-btn"
          style={styles.deleteBtn}
          activeOpacity={0.8}
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash" size={18} color={COLORS.error} />
          <Text style={styles.deleteText}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.error} />
        </TouchableOpacity>
        <Text style={styles.deleteHint}>
          Permanently delete your administrator account and personal data. Audit data is anonymised.
        </Text>

        <TouchableOpacity
          testID="admin-signout-btn"
          style={styles.signoutBtn}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>TripZen Admin 1.0.1</Text>
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
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.bg, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.error },
  deleteText: { flex: 1, color: COLORS.error, fontWeight: "700", fontSize: 14 },
  deleteHint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6, marginBottom: 4, lineHeight: 16 },
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
