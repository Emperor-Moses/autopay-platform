import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme";
import Button from "./Button";

export default function EmptyState({ icon = "📭", title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Button title={actionLabel} onPress={onAction} style={{ maxWidth: 220, marginTop: 6 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 26 },
  title: { fontFamily: "DMSerifDisplay", fontSize: 17, color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: COLORS.muted, textAlign: "center", lineHeight: 20, maxWidth: 230, marginBottom: 16 },
});
