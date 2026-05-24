// Web fallback - react-native-maps doesn't support web
import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS } from "@/src/constants/theme";

type Props = { style?: any; region?: any; children?: any; pointerEvents?: any };

function MapView({ style, region }: Props) {
  // Render a static OpenStreetMap-style placeholder showing approx position
  const lat = region?.latitude ?? 51.5074;
  const lng = region?.longitude ?? -0.1278;
  return (
    <View style={[styles.container, style]}>
      <Image
        source={{
          uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=600x400&markers=${lat},${lng},red-circle`,
        }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <Text style={styles.label}>Live map (native preview)</Text>
        <Text style={styles.sub}>
          Lat {lat.toFixed(4)}, Lng {lng.toFixed(4)}
        </Text>
      </View>
    </View>
  );
}

export const Marker: React.FC<any> = () => null;
export const Polyline: React.FC<any> = () => null;
export const PROVIDER_DEFAULT = undefined;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  overlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(15, 27, 61, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  label: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sub: { color: "#fff", fontSize: 10, opacity: 0.8, marginTop: 2 },
});

export default MapView;
