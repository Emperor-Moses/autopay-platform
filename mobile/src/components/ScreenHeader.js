import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../theme";

export default function ScreenHeader({ title, onBack, right }) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>←</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.btn} />
      )}
      <Text style={styles.title}>{title}</Text>
      {right || <View style={styles.btn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.greenPale,
    borderWidth: 1,
    borderColor: COLORS.greenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 16, color: COLORS.green },
  title: { fontFamily: "DMSerifDisplay", fontSize: 17, color: COLORS.dark },
});
