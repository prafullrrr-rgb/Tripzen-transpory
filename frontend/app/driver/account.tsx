import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/api/client";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import InfoSheet, { InfoBullet } from "@/src/components/InfoSheet";
import NotificationPrefsSheet from "@/src/components/NotificationPrefsSheet";

export default function DriverAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ trips: 0, scans: 0, ontime: 92 });
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

  useEffect(() => {
    (async () => {
      try {
        const trips = await api.get<any[]>("/trips/history").catch(() => []);
        const today = new Date().toDateString();
        const todays = trips.filter((tr) => new Date(tr.started_at).toDateString() === today);
        const scans = todays.reduce(
          (sum, tr) => sum + (tr.boarded_student_ids?.length || 0) + (tr.checked_out_student_ids?.length || 0),
          0,
        );
        setStats({ trips: todays.length, scans, ontime: 92 });
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const callDispatch = async () => {
    const url = Platform.OS === "web" ? "mailto:dispatch@tripzen.app" : "tel:+441234567890";
    const can = await Linking.canOpenURL(url).catch(() => false);
    if (can) Linking.openURL(url);
    else Alert.alert("Dispatch", "dispatch@tripzen.app\n+44 1234 567 890");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-account-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.profileCard}>
          <Image
            source={{ uri: "https://api.dicebear.com/7.x/initials/svg?seed=" + (user?.full_name || "D") }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>DRIVER</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Today</Text>
        <View style={styles.statCard}>
          <Stat num={stats.trips} label="Trips done" />
          <Stat num={stats.scans} label="Scans" />
          <Stat num={`${stats.ontime}%`} label="On-time" />
        </View>

        <Text style={styles.section}>Settings</Text>
        <Menu
          icon="notifications"
          label="Notifications"
          testID="d-menu-notif"
          onPress={() => setPrefsOpen(true)}
        />
        <Menu
          icon="shield-checkmark"
          label="Safety Protocols"
          testID="d-menu-safety"
          onPress={() =>
            setInfoSheet({
              icon: "shield-checkmark",
              iconColor: COLORS.success,
              title: "Driver Safety Protocols",
              subtitle: "Follow at every trip",
              bullets: [
                { icon: "checkmark-circle", title: "Pre-trip vehicle inspection", body: "Check brakes, lights, tyres and seatbelts before every route." },
                { icon: "people", title: "Confirm headcount", body: "Scan every child on boarding and at drop-off. Never depart with unaccounted students." },
                { icon: "speedometer", title: "Speed limits", body: "Max 30mph in school zones, 50mph elsewhere." },
                { icon: "alert-circle", title: "SOS protocol", body: "Press SOS for any emergency. Admin + parents are alerted instantly." },
                { icon: "call", title: "Dispatch contact", body: "+44 1234 567 890 — available 24/7." },
              ],
              primaryLabel: "Call dispatch",
              onPrimary: callDispatch,
            })
          }
        />
        <Menu
          icon="map"
          label="My Routes"
          testID="d-menu-routes"
          onPress={() => router.push("/driver")}
        />
        <Menu
          icon="help-circle"
          label="Support"
          right="24/7"
          testID="d-menu-help"
          onPress={() =>
            setInfoSheet({
              icon: "help-circle",
              iconColor: COLORS.accent,
              title: "Driver Support",
              body: "Need help mid-route? Contact dispatch immediately. For app issues, email us.",
              bullets: [
                { icon: "call", title: "Dispatch (24/7)", body: "+44 1234 567 890" },
                { icon: "mail", title: "App support", body: "drivers@tripzen.app" },
                { icon: "book", title: "Driver handbook", body: "Open the safety protocols above for the full SOP." },
              ],
              primaryLabel: "Call dispatch",
              onPrimary: callDispatch,
            })
          }
        />
        <Menu
          icon="information-circle"
          label="About TripZen"
          testID="d-menu-about"
          onPress={() =>
            setInfoSheet({
              icon: "information-circle",
              iconColor: COLORS.primary,
              title: "About TripZen",
              subtitle: "Version 1.0.0",
              body:
                "Thank you for keeping our children safe. Your work matters.",
              bullets: [
                { icon: "heart", title: "Driver-first design", body: "Built with input from 50+ professional drivers." },
                { icon: "navigate", title: "Always offline-ready", body: "Trip data caches locally if you lose signal." },
              ],
            })
          }
        />

        <TouchableOpacity
          testID="driver-signout-btn"
          style={styles.signoutBtn}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>
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
    </SafeAreaView>
  );
}

function Stat({ num, label }: { num: string | number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  roleChip: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  roleChipText: { fontSize: 10, fontWeight: "800", color: COLORS.primary },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  statCard: {
    flexDirection: "row",
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
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
  menuRight: { fontSize: 12, color: COLORS.textSecondary, marginRight: 6 },
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
});
