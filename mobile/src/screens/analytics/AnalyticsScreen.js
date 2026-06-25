import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { COLORS, TYPE_META } from "../../theme";
import { NGN } from "../../utils/format";
import { PaymentsAPI, SchedulesAPI, BeneficiariesAPI } from "../../api/resources";
import ScreenHeader from "../../components/ScreenHeader";

export default function AnalyticsScreen({ navigation }) {
  const txnQ = useQuery({ queryKey: ["transactions", "all-success"], queryFn: () => PaymentsAPI.list({ limit: 200, status: "success" }) });
  const schedQ = useQuery({ queryKey: ["schedules"], queryFn: () => SchedulesAPI.list() });
  const beneQ = useQuery({ queryKey: ["beneficiaries"], queryFn: BeneficiariesAPI.list });

  const txns = txnQ.data?.data || [];
  const total = txns.reduce((s, t) => s + Number(t.amount), 0);

  const byType = {};
  txns.forEach((t) => {
    byType[t.type] = (byType[t.type] || 0) + Number(t.amount);
  });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const maxVal = types[0]?.[1] || 1;

  const activeCount = (schedQ.data || []).filter((s) => s.status === "active").length;

  const cards = [
    { label: "Total Sent", val: NGN(total), icon: "💸", color: COLORS.green },
    { label: "Transactions", val: txns.length, icon: "📊", color: COLORS.blue },
    { label: "Active Schedules", val: activeCount, icon: "📅", color: COLORS.gold },
    { label: "Recipients", val: (beneQ.data || []).length, icon: "👥", color: COLORS.purple },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="Analytics" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.grid}>
          {cards.map((c) => (
            <View key={c.label} style={styles.card}>
              <Text style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</Text>
              <Text style={[styles.cardVal, { color: c.color }]}>{c.val}</Text>
              <Text style={styles.cardLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          {types.length === 0 ? (
            <Text style={styles.emptyText}>No successful payments yet</Text>
          ) : (
            types.map(([t, v]) => {
              const meta = TYPE_META[t] || TYPE_META.Other;
              return (
                <View key={t} style={{ marginBottom: 10 }}>
                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>
                      {meta.icon} {t}
                    </Text>
                    <Text style={[styles.barValue, { color: COLORS.green }]}>{NGN(v)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.round((v / maxVal) * 100)}%`, backgroundColor: meta.fg }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  card: { width: "47%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  cardVal: { fontSize: 18, fontWeight: "700" },
  cardLabel: { fontSize: 11, color: COLORS.muted2, marginTop: 2 },
  section: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  emptyText: { fontSize: 13, color: COLORS.muted2, textAlign: "center", paddingVertical: 16 },
  barRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabel: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  barValue: { fontSize: 12, fontWeight: "700" },
  barTrack: { height: 7, borderRadius: 100, backgroundColor: COLORS.bg, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 100 },
});
