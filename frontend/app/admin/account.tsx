import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";
import { confirm } from "@/src/utils/confirm";

export default function AdminAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

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

        <Text style={styles.section}>Settings</Text>
        <Menu icon="shield-checkmark" label="Compliance & GDPR" testID="a-menu-compliance" />
        <Menu icon="language" label="Languages" testID="a-menu-lang" />
        <Menu icon="cog" label="System Settings" testID="a-menu-system" />

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
    </SafeAreaView>
  );
}

function Menu({ icon, label, testID, onPress }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.menuItem} activeOpacity={0.7} onPress={onPress}>
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
  roleChipText: { fontSize: 10, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },
  section: {
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
  footer: { textAlign: "center", fontSize: 11, color: COLORS.textSecondary, marginTop: SPACING.lg },
});
