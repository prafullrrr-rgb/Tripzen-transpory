import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { storage } from "@/src/utils/storage";
import { COLORS, SPACING, RADIUS } from "@/src/constants/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "location",
    title: "Always know where your child is",
    sub: "Live GPS tracking, instant alerts when they board and arrive — never wonder again.",
    color: COLORS.accent,
  },
  {
    icon: "shield-checkmark",
    title: "Safety first, always",
    sub: "QR badges, verified handovers, emergency SOS, geofenced stops. Built for peace of mind.",
    color: COLORS.success,
  },
  {
    icon: "chatbubbles",
    title: "Stay connected with the driver",
    sub: "Direct chat, ratings, and AI-generated weekly summaries — everything in one app.",
    color: COLORS.primary,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const next = async () => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      await storage.setItem("tz_onboarded", true);
      router.replace("/login");
    }
  };

  const skip = async () => {
    await storage.setItem("tz_onboarded", true);
    router.replace("/login");
  };

  const slide = SLIDES[index];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="onboarding-screen">
      <View style={styles.header}>
        <Text style={styles.brand}>TripZen</Text>
        <TouchableOpacity onPress={skip} testID="onboard-skip-btn">
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: slide.color }]}>
          <Ionicons name={slide.icon as any} size={56} color="#fff" />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.sub}>{slide.sub}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <TouchableOpacity testID="onboard-next-btn" style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.nextText}>
            {index === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
          <Ionicons
            name={index === SLIDES.length - 1 ? "arrow-forward-circle" : "arrow-forward"}
            size={20}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  brand: { fontSize: 20, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  skip: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.lg },
  iconBox: {
    width: 140,
    height: 140,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.primary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.md,
    lineHeight: 22,
    maxWidth: 320,
  },
  footer: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: SPACING.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 28,
    backgroundColor: COLORS.accent,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
  },
  nextText: { color: COLORS.primary, fontWeight: "800", fontSize: 16 },
});
