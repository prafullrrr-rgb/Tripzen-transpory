import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import { confirm } from "@/src/utils/confirm";

export default function DriverAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
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
          <View style={styles.statItem}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Trips done</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Scans</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>92%</Text>
            <Text style={styles.statLabel}>On-time</Text>
          </View>
        </View>

        <Text style={styles.section}>Settings</Text>
        <Menu icon="notifications" label="Notifications" testID="d-menu-notif" />
        <Menu icon="shield-checkmark" label="Safety Protocols" testID="d-menu-safety" />
        <Menu icon="help-circle" label="Support" testID="d-menu-help" />

        <TouchableOpacity
          testID="driver-signout-btn"
          style={styles.signoutBtn}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Menu({ icon, label, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.menuItem} activeOpacity={0.7}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
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
