import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS } from "../../theme";
import { NGN, fmtDate, cap } from "../../utils/format";
import { FREQ_LABEL } from "../../theme";
import { SchedulesAPI } from "../../api/resources";
import { apiErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import ScreenHeader from "../../components/ScreenHeader";
import Badge from "../../components/Badge";
import Button from "../../components/Button";

export default function ScheduleDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: sch, isLoading } = useQuery({
    queryKey: ["schedule", id],
    queryFn: () => SchedulesAPI.get(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["schedule", id] });
  }

  const pauseMut = useMutation({
    mutationFn: () => SchedulesAPI.pause(id),
    onSuccess: () => {
      invalidate();
      showToast("Schedule paused");
    },
    onError: (e) => showToast(apiErrorMessage(e), "error"),
  });

  const resumeMut = useMutation({
    mutationFn: () => SchedulesAPI.resume(id),
    onSuccess: () => {
      invalidate();
      showToast("Schedule resumed ✓");
    },
    onError: (e) => showToast(apiErrorMessage(e), "error"),
  });

  const cancelMut = useMutation({
    mutationFn: () => SchedulesAPI.cancel(id),
    onSuccess: () => {
      invalidate();
      showToast("Schedule cancelled");
      navigation.goBack();
    },
    onError: (e) => showToast(apiErrorMessage(e), "error"),
  });

  function confirmCancel() {
    Alert.alert("Cancel Schedule", "This will permanently cancel this payment schedule.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel Schedule", style: "destructive", onPress: () => cancelMut.mutate() },
    ]);
  }

  if (isLoading || !sch) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <ScreenHeader title="Schedule" onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const bene = sch.beneficiary;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title={bene?.name || sch.type} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          {[
            ["Recipient", bene?.name || "—"],
            ["Bank", bene ? `${bene.bank} · ···${bene.accountNumber?.slice(-4)}` : "—"],
            ["Type", sch.type],
            ["Amount", NGN(sch.amount)],
            ["Frequency", FREQ_LABEL[sch.frequency]],
            ["Next Payment", fmtDate(sch.nextRunAt)],
            ...(sch.note ? [["Note", sch.note]] : []),
          ].map(([l, v]) => (
            <View key={l} style={styles.row}>
              <Text style={styles.rowLabel}>{l}</Text>
              <Text style={styles.rowValue}>{v}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <Badge
              label={cap(sch.status)}
              tone={sch.status === "active" ? "neutral" : sch.status === "paused" ? "warn" : "muted"}
            />
          </View>
        </View>

        {sch.transactions?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {sch.transactions.slice(0, 5).map((t) => (
              <View key={t.id} style={styles.txnRow}>
                <Text style={styles.txnDate}>{fmtDate(t.initiatedAt)}</Text>
                <Text style={styles.txnAmount}>{NGN(t.amount)}</Text>
                <Badge
                  label={cap(t.status)}
                  tone={t.status === "success" ? "neutral" : t.status === "failed" ? "danger" : "muted"}
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {sch.status === "active" && (
            <Button
              title="⏸ Pause Schedule"
              onPress={() => pauseMut.mutate()}
              loading={pauseMut.isPending}
              style={{ backgroundColor: COLORS.goldPale, borderWidth: 1, borderColor: "#f0d8b0" }}
            />
          )}
          {sch.status === "paused" && (
            <Button title="▶ Resume Schedule" onPress={() => resumeMut.mutate()} loading={resumeMut.isPending} />
          )}
          {sch.status === "active" && (
            <Button title="Cancel Schedule" variant="danger" onPress={confirmCancel} loading={cancelMut.isPending} />
          )}
          <Button title="Close" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: "center" },
  rowLabel: { fontSize: 13, color: COLORS.muted },
  rowValue: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  txnRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  txnDate: { fontSize: 12, color: COLORS.muted, flex: 1 },
  txnAmount: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginHorizontal: 10 },
  actions: { gap: 10 },
});
