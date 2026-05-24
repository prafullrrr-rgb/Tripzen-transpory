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

const ROLES: { key: "parent" | "driver" | "admin"; label: string; icon: string }[] = [
  { key: "parent", label: "Parent", icon: "people" },
  { key: "driver", label: "Driver", icon: "bus" },
  { key: "admin", label: "Admin", icon: "shield-checkmark" },
];

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [role, setRole] = useState<"parent" | "driver" | "admin">("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert("Missing info", "Name, email, and password are required");
      return;
    }
    setLoading(true);
    try {
      const u = await signUp({
        email: email.trim(),
        password,
        full_name: name.trim(),
        role,
        phone: phone.trim() || undefined,
      });
      router.replace(`/${u.role}`);
    } catch (e: any) {
      Alert.alert("Registration failed", e.message || "Unable to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            testID="register-back-btn"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join TripZen for safer rides</Text>

          {/* Role picker */}
          <Text style={styles.label}>I am a</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                testID={`role-${r.key}-btn`}
                style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
                onPress={() => setRole(r.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={r.icon as any}
                  size={22}
                  color={role === r.key ? COLORS.primary : COLORS.textSecondary}
                />
                <Text
                  style={[styles.roleLabel, role === r.key && { color: COLORS.primary, fontWeight: "700" }]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            testID="register-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Priya Sharma"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="register-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@tripzen.com"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput
            testID="register-phone-input"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+44 7700 900000"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="register-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
          />

          <TouchableOpacity
            testID="register-submit-button"
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.primaryBtnText}>Create account</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: 6, marginBottom: SPACING.lg },
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
  roleRow: { flexDirection: "row", gap: SPACING.sm },
  roleBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  roleBtnActive: {
    backgroundColor: COLORS.accentLight,
    borderColor: COLORS.accent,
  },
  roleLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  primaryBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 16 },
});
