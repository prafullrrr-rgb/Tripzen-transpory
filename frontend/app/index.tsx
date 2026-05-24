import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { storage } from "@/src/utils/storage";
import { COLORS } from "@/src/constants/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const v = await storage.getItem("tz_onboarded", false);
      setOnboarded(v === true);
      setChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (loading || !checked) return;
    if (!user && !onboarded) {
      router.replace("/onboarding");
      return;
    }
    if (!user) {
      router.replace("/login");
    } else if (user.role === "parent") {
      router.replace("/parent");
    } else if (user.role === "driver") {
      router.replace("/driver");
    } else if (user.role === "admin") {
      router.replace("/admin");
    }
  }, [user, loading, checked, onboarded, router]);

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
