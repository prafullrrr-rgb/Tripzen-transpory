import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

const DEMO_ACCOUNTS = [
  { role: "Parent", email: "priya@tripzen.com", password: "parent123", icon: "people" },
  { role: "Driver", email: "driver@tripzen.com", password: "driver123", icon: "bus" },
  { role: "Admin", email: "admin@tripzen.com", password: "admin123", icon: "shield-checkmark" },
];

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      router.replace(`/${u.role}`);
    } catch (e: any) {
      Alert.alert("Login failed", e.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo / Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logoBox} testID="login-logo">
              <Ionicons name="bus" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.brand}>TripZen</Text>
            <Text style={styles.tagline}>Safe Rides. Happy Families.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@tripzen.com"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
            />

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="login-register-link"
              style={styles.linkBtn}
              onPress={() => router.push("/register")}
            >
              <Text style={styles.linkText}>
                New here? <Text style={{ fontWeight: "700" }}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Demo accounts — only visible in dev / non-production builds */}
          {__DEV__ && (
            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Try a demo account</Text>
              {DEMO_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.role}
                  testID={`demo-${acc.role.toLowerCase()}-btn`}
                  style={styles.demoCard}
                  onPress={() => fillDemo(acc)}
                  activeOpacity={0.7}
                >
                  <View style={styles.demoIcon}>
                    <Ionicons name={acc.icon as any} size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoRole}>{acc.role}</Text>
                    <Text style={styles.demoEmail}>{acc.email}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  brandSection: { alignItems: "center", marginTop: SPACING.lg, marginBottom: SPACING.xl },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  brand: { fontSize: 30, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  form: { marginTop: SPACING.md },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 16 },
  linkBtn: { alignItems: "center", marginTop: SPACING.md },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  demoSection: { marginTop: SPACING.xl },
  demoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  demoRole: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  demoEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
