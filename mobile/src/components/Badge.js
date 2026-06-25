import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

const TONES = {
  neutral: { bg: COLORS.greenPale, fg: COLORS.green, border: COLORS.greenDim },
  warn:    { bg: COLORS.goldPale,  fg: COLORS.gold,  border: "#f0d8b0" },
  danger:  { bg: COLORS.redPale,   fg: COLORS.red,   border: "#f0c8c8" },
  muted:   { bg: COLORS.bg,        fg: COLORS.muted, border: COLORS.border },
  info:    { bg: COLORS.bluePale,  fg: COLORS.blue,  border: "#c8d8f0" },
};

export default function Badge({ label, tone = "neutral", style }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});
