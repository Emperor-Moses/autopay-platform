import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";
import { NGN } from "../utils/format";
import Button from "./Button";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function PinModal({ visible, amount, onSubmit, onClose, error, verifying }) {
  const [digits, setDigits] = useState([]);

  function press(k) {
    if (k === "⌫") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;
    const next = [...digits, k];
    setDigits(next);
    if (next.length === 4) {
      onSubmit(next.join(""));
      setTimeout(() => setDigits([]), 400);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Confirm Payment</Text>
          <Text style={styles.subtitle}>Enter your 4-digit PIN to authorise</Text>
          {amount != null && <Text style={styles.amount}>{NGN(amount)}</Text>}

          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { borderColor: error ? COLORS.red : digits.length > i ? COLORS.green : COLORS.border },
                  digits.length > i && { backgroundColor: error ? COLORS.red : COLORS.green },
                ]}
              />
            ))}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.keypad}>
            {KEYS.map((k, i) => (
              <TouchableOpacity
                key={i}
                style={styles.key}
                disabled={k === "" || verifying}
                onPress={() => press(k)}
                activeOpacity={0.6}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button title="Cancel" variant="outline" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(12,20,12,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 14 },
  title: { fontFamily: "DMSerifDisplay", fontSize: 19, textAlign: "center", color: COLORS.dark },
  subtitle: { fontSize: 12, color: COLORS.muted, textAlign: "center", marginTop: 4 },
  amount: { fontFamily: "DMSerifDisplay", fontSize: 26, fontWeight: "700", color: COLORS.green, textAlign: "center", marginTop: 8, marginBottom: 6 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 14 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2.5 },
  errorText: { textAlign: "center", fontSize: 12, fontWeight: "600", color: COLORS.red, marginBottom: 4 },
  keypad: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6 },
  key: {
    width: "33.33%",
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 22, fontWeight: "600", color: COLORS.dark },
});
