import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import { api } from "@/src/api/client";
import { SUPPORTED_LANGS, setLanguage } from "@/src/i18n";
import i18n from "@/src/i18n";
import InfoSheet, { InfoBullet } from "@/src/components/InfoSheet";
import NotificationPrefsSheet from "@/src/components/NotificationPrefsSheet";

export default function ParentAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
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

  const openSupportChat = async () => {
    try {
      const res = await api.get<{ contact: { id: string; full_name: string } | null }>(
        "/support/contact",
      );
      if (!res.contact) {
        Alert.alert("Support", "No support agent available right now.");
        return;
      }
      router.push({
        pathname: "/chat",
        params: {
          other_id: res.contact.id,
          other_name: res.contact.full_name || "TripZen Support",
        },
      });
    } catch (e: any) {
      Alert.alert("Support", e.message || "Could not open chat");
    }
  };

  const activeLang = SUPPORTED_LANGS.find((l) => l.code === currentLang) || SUPPORTED_LANGS[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="parent-account-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}>
        <Text style={styles.title}>{t("admin.account")}</Text>

        <View style={styles.profileCard}>
          <Image
            source={{ uri: "https://api.dicebear.com/7.x/initials/svg?seed=" + (user?.full_name || "U") }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{user?.role?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Settings</Text>
        <MenuItem
          icon="notifications"
          label={t("settings.notifications")}
          testID="menu-notifications"
          onPress={() => setPrefsOpen(true)}
        />
        <MenuItem
          icon="card"
          label="Payment Methods"
          testID="menu-payments"
          onPress={() =>
            setInfoSheet({
              icon: "card",
              iconColor: COLORS.success,
              title: "Payment Methods",
              subtitle: "Powered by Stripe",
              body:
                "All payments are processed securely by Stripe. Add or change your payment method during checkout.",
              bullets: [
                { icon: "lock-closed", title: "Secure", body: "Card details never touch our servers." },
                { icon: "card", title: "All major cards", body: "Visa, Mastercard, Amex, Apple Pay, Google Pay." },
                { icon: "people", title: "Sibling discount", body: "20% off automatically on second monthly plan." },
              ],
              primaryLabel: "Book a trip",
              onPrimary: () => router.push("/parent/booking"),
            })
          }
        />
        <MenuItem
          icon="language"
          label={t("settings.language")}
          right={`${activeLang.flag} ${activeLang.label}`}
          testID="menu-language"
          onPress={() => setLangOpen(true)}
        />
        <MenuItem
          icon="shield-checkmark"
          label="Privacy & Security"
          testID="menu-privacy"
          onPress={() =>
            setInfoSheet({
              icon: "shield-checkmark",
              iconColor: COLORS.primary,
              title: "Privacy & Security",
              subtitle: "Your data is protected",
              bullets: [
                { icon: "lock-closed", title: "End-to-end encryption", body: "All trip data is encrypted in transit (TLS 1.3) and at rest." },
                { icon: "eye-off", title: "No third-party tracking", body: "We never sell your data or your child's location to advertisers." },
                { icon: "people", title: "Verified drivers only", body: "Every driver is DBS-checked, trained and continuously monitored." },
                { icon: "trash", title: "Right to be forgotten", body: "Delete your account anytime — see GDPR options below." },
              ],
            })
          }
        />

        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <MenuItem
          icon="download"
          label={t("settings.gdprExport")}
          testID="menu-gdpr-export"
          onPress={async () => {
            try {
              const data = await api.get<any>("/parent/gdpr-export");
              const summary = `Export ready!\n\nChildren: ${data.children.length}\nBookings: ${data.bookings.length}\nNotifications: ${data.notifications.length}\nMessages: ${data.messages.length}\nRatings: ${data.ratings.length}\n\nExported: ${new Date(data.exported_at).toLocaleString()}`;
              Alert.alert("GDPR Export", summary);
            } catch (e: any) {
              Alert.alert("Failed", e.message);
            }
          }}
        />
        <MenuItem
          icon="trash"
          label="Delete My Account"
          testID="menu-gdpr-delete"
          onPress={() =>
            setInfoSheet({
              icon: "warning",
              iconColor: COLORS.error,
              title: "Delete Account?",
              subtitle: "This is permanent",
              body:
                "Deleting your account removes all children, bookings, messages and ratings. This cannot be undone.",
              bullets: [
                { icon: "alert-circle", title: "Loss of data", body: "Active bookings will not be refunded." },
                { icon: "time", title: "30-day grace", body: "Contact support within 30 days to recover." },
              ],
              primaryLabel: "I understand — Delete",
              onPrimary: async () => {
                try {
                  await api.delete("/parent/account");
                  await signOut();
                  router.replace("/login");
                } catch (e: any) {
                  Alert.alert("Failed", e.message);
                }
              },
            })
          }
        />

        <Text style={styles.sectionTitle}>Support</Text>
        <MenuItem
          icon="chatbubbles"
          label="Chat with Support"
          right="24/7"
          testID="menu-support-chat"
          onPress={openSupportChat}
        />
        <MenuItem
          icon="help-circle"
          label="Help Center"
          testID="menu-help"
          onPress={() =>
            setInfoSheet({
              icon: "help-circle",
              iconColor: COLORS.accent,
              title: "How can we help?",
              bullets: [
                { icon: "play-circle", title: "Getting started", body: "Add your child → link to a route → book a plan → track live." },
                { icon: "card", title: "Billing", body: "Manage your subscription from Payment Methods. Cancel anytime." },
                { icon: "bus", title: "Missed pickup?", body: "Open chat with the driver from the home screen." },
                { icon: "warning", title: "Emergency", body: "If your child is missing, tap the SOS button or chat support." },
              ],
              primaryLabel: "Chat with Support",
              onPrimary: openSupportChat,
            })
          }
        />
        <MenuItem
          icon="information-circle"
          label="About TripZen"
          testID="menu-about"
          onPress={() =>
            setInfoSheet({
              icon: "information-circle",
              iconColor: COLORS.primary,
              title: "About TripZen",
              subtitle: "Version 1.0.0",
              body:
                "TripZen is the safest way to send your child to school. Built with safety, transparency and trust at its core.",
              bullets: [
                { icon: "people", title: "DBS-verified drivers", body: "Every driver passes enhanced background checks." },
                { icon: "navigate", title: "Real-time tracking", body: "Always know where your child is." },
                { icon: "sparkles", title: "AI-powered insights", body: "Weekly summaries by Claude." },
                { icon: "heart", title: "Made with love", body: "© 2025 TripZen Ltd. UK." },
              ],
            })
          }
        />

        <TouchableOpacity
          testID="signout-btn"
          style={styles.signoutBtn}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.signoutText}>{t("auth.signOut")}</Text>
        </TouchableOpacity>

        <Text style={styles.brandFooter}>TripZen v1.0 • Safe today. Stronger tomorrow.</Text>
      </ScrollView>

      {/* Language picker modal */}
      <Modal visible={langOpen} animationType="slide" transparent onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("settings.language")}</Text>
              <TouchableOpacity onPress={() => setLangOpen(false)} testID="close-lang-modal">
                <Ionicons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{t("settings.languageDesc")}</Text>
            {SUPPORTED_LANGS.map((l) => (
              <TouchableOpacity
                key={l.code}
                testID={`lang-${l.code}`}
                style={[styles.langRow, currentLang === l.code && styles.langRowActive]}
                onPress={() => pickLang(l.code)}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={styles.langLabel}>{l.label}</Text>
                {currentLang === l.code && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      {/* Notification preferences sheet */}
      <NotificationPrefsSheet visible={prefsOpen} onClose={() => setPrefsOpen(false)} />

      {/* Generic info sheet for misc tabs */}
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
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, right, testID, onPress }: { icon: string; label: string; right?: string; testID?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity testID={testID} style={styles.menuItem} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon as any} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {right && <Text style={styles.menuRight}>{right}</Text>}
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
  roleChip: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  roleChipText: { fontSize: 10, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  menuLabel: { flex: 1, fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  menuRight: { fontSize: 13, color: COLORS.textSecondary, marginRight: 6 },
  signoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.errorBg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  signoutText: { color: COLORS.error, fontWeight: "700", fontSize: 14 },
  brandFooter: {
    textAlign: "center",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 27, 61, 0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 28 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  modalSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
  },
  langRowActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: COLORS.primary },
});
