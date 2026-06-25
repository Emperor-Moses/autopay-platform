import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, RADIUS, TYPE_META, FREQ_LABEL } from "../theme";
import { NGN, urgencyLabel, urgencyTone } from "../utils/format";
import Badge from "./Badge";

export default function ScheduleCard({ schedule, beneficiary, onPress }) {
  const meta = TYPE_META[schedule.type] || TYPE_META.Other;
  const tone = urgencyTone(schedule.nextRunAt || schedule.nextDate);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Text style={styles.icon}>{meta.icon}</Text>
      </View>
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {beneficiary?.name || schedule.type}
        </Text>
        <Text style={styles.sub}>
          {FREQ_LABEL[schedule.frequency]} · {beneficiary?.bank || beneficiary?.bankName || ""}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{NGN(schedule.amount)}</Text>
        <Badge label={urgencyLabel(schedule.nextRunAt || schedule.nextDate)} tone={tone} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 9,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 17 },
  middle: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  sub: { fontSize: 11, color: COLORS.muted2, marginTop: 2 },
  right: { alignItems: "flex-end" },
  amount: { fontSize: 14, fontWeight: "700", color: COLORS.text },
});
