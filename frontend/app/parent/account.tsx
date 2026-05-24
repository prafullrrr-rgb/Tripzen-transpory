import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import { confirm } from "@/src/utils/confirm";

export default function ParentAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="parent-account-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}>
        <Text style={styles.title}>Account</Text>

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
        <MenuItem icon="notifications" label="Notifications" testID="menu-notifications" />
        <MenuItem icon="card" label="Payment Methods" testID="menu-payments" />
        <MenuItem icon="language" label="Language" right="English" testID="menu-language" />
        <MenuItem icon="shield-checkmark" label="Privacy & Security" testID="menu-privacy" />

        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <MenuItem
          icon="download"
          label="Export My Data (GDPR)"
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
        <MenuItem icon="shield-checkmark" label="Privacy & Security" testID="menu-privacy" />

        <Text style={styles.sectionTitle}>Support</Text>
        <MenuItem icon="help-circle" label="Help Center" testID="menu-help" />
        <MenuItem icon="call" label="24/7 Support" testID="menu-support" />
        <MenuItem icon="information-circle" label="About TripZen" testID="menu-about" />

        <TouchableOpacity
          testID="signout-btn"
          style={styles.signoutBtn}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.brandFooter}>TripZen v1.0 • Safe today. Stronger tomorrow.</Text>
      </ScrollView>
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
});
