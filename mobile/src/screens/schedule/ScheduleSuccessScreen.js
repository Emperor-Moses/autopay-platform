import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { COLORS } from "../../theme";
import { NGN, fmtDate, FREQ_LABEL } from "../../utils/format";
import { FREQ_LABEL as FL } from "../../theme";
import Button from "../../components/Button";

export default function ScheduleSuccessScreen({ route, navigation }) {
  const { schedule, payload } = route.params;

  return (
    <View style={styles.wrap}>
      <View style={styles.ringWrap}>
        <Svg width={110} height={110} viewBox="0 0 120 120">
          <Circle cx={60} cy={60} r={45} fill="none" stroke={COLORS.greenDim} strokeWidth={6} />
          <Circle
            cx={60} cy={60} r={45} fill="none" stroke={COLORS.green} strokeWidth={6}
            strokeDasharray="283" strokeDashoffset="28" strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </Svg>
        <Text style={styles.checkEmoji}>✅</Text>
      </View>

      <Text style={styles.title}>Payment Scheduled!</Text>
      <Text style={styles.subtitle}>
        AutoPay will debit {NGN(payload.amount)} from your linked account on {fmtDate(payload.startDate)}.
      </Text>

      <View style={styles.card}>
        {[
          ["Recipient", payload.beneficiaryName || "—"],
          ["Amount", NGN(payload.amount)],
          ["Frequency", FL[payload.frequency]],
          ["First Payment", fmtDate(payload.startDate)],
          ["Reference", schedule?.internalRef || schedule?.ref || "—"],
        ].map(([l, v]) => (
          <View key={l} style={styles.row}>
            <Text style={styles.rowLabel}>{l}</Text>
            <Text style={[styles.rowValue, l === "Reference" && styles.mono]}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={{ width: "100%", gap: 10 }}>
        <Button title="Schedule Another" onPress={() => navigation.replace("Schedule")} />
        <Button title="Back to Dashboard" variant="outline" onPress={() => navigation.popToTop()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 26 },
  ringWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  checkEmoji: { position: "absolute", fontSize: 32 },
  title: { fontFamily: "DMSerifDisplay", fontSize: 26, color: COLORS.dark, marginBottom: 8 },
  subtitle: { fontSize: 13, color: COLORS.muted, textAlign: "center", lineHeight: 20, maxWidth: 280, marginBottom: 24 },
  card: { width: "100%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 18, marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { fontSize: 13, color: COLORS.muted },
  rowValue: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  mono: { fontFamily: "monospace", fontSize: 11 },
});
