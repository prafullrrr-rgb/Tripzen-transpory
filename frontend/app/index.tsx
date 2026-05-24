import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { COLORS } from "@/src/constants/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "parent") {
      router.replace("/parent");
    } else if (user.role === "driver") {
      router.replace("/driver");
    } else if (user.role === "admin") {
      router.replace("/admin");
    }
  }, [user, loading, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color={COLORS.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
});
