import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

export default function Button({
  title,
  onPress,
  variant = "primary", // primary | outline | danger | dangerSoft
  loading = false,
  disabled = false,
  small = false,
  style,
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        small && styles.small,
        variant === "primary" && styles.primary,
        variant === "outline" && styles.outline,
        variant === "danger" && styles.danger,
        variant === "dangerSoft" && styles.dangerSoft,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? COLORS.green : "#fff"} />
      ) : (
        <Text
          style={[
            styles.text,
            small && styles.smallText,
            variant === "outline" && styles.outlineText,
            variant === "dangerSoft" && styles.dangerSoftText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  small: { width: "auto", paddingVertical: 9, paddingHorizontal: 16, borderRadius: RADIUS.sm },
  primary: { backgroundColor: COLORS.green },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: COLORS.border },
  danger: { backgroundColor: COLORS.red },
  dangerSoft: { backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: "#f0c8c8" },
  disabled: { opacity: 0.5 },
  text: { color: "#fff", fontSize: 15, fontWeight: "600" },
  smallText: { fontSize: 13 },
  outlineText: { color: COLORS.green },
  dangerSoftText: { color: COLORS.red },
});
