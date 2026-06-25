import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, TYPE_META } from "../../theme";
import { NGN, fmtDate } from "../../utils/format";
import { BeneficiariesAPI, PaymentsAPI } from "../../api/resources";
import { UsersAPI } from "../../api/users";
import { apiErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import ScreenHeader from "../../components/ScreenHeader";
import FormField from "../../components/FormField";
import Button from "../../components/Button";

const TYPES = Object.keys(TYPE_META);

export default function BulkScreen({ navigation }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const beneQ = useQuery({ queryKey: ["beneficiaries"], queryFn: BeneficiariesAPI.list });
  const bankQ = useQuery({ queryKey: ["bankAccounts"], queryFn: UsersAPI.bankAccounts });

  const [rows, setRows] = useState([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("Staff");

  const hasBank = (bankQ.data || []).length > 0;
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const bulkMut = useMutation({
    mutationFn: (payload) => PaymentsAPI.bulk(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      showToast(`${rows.length} payments queued ✓`);
      navigation.goBack();
    },
    onError: (e) => showToast(apiErrorMessage(e, "Could not submit batch"), "error"),
  });

  function addRow() {
    if (!beneficiaryId || !amount) {
      showToast("Select recipient and amount", "error");
      return;
    }
    const bene = beneQ.data?.find((b) => b.id === beneficiaryId);
    setRows((p) => [
      ...p,
      { id: `row_${Date.now()}`, beneficiaryId, beneName: bene?.name, amount: parseFloat(amount), type },
    ]);
    setBeneficiaryId("");
    setAmount("");
  }

  function removeRow(id) {
    setRows((p) => p.filter((r) => r.id !== id));
  }

  function submitBatch() {
    bulkMut.mutate({
      payments: rows.map((r) => ({ beneficiaryId: r.beneficiaryId, amount: r.amount, type: r.type })),
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="Bulk Pay" onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                👥 <Text style={{ fontWeight: "700" }}>Bulk Pay</Text> — schedule multiple payments at once. Perfect
                for payroll and multi-vendor batches.
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Recipient</Text>
              {(beneQ.data || []).map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.beneOption, beneficiaryId === b.id && styles.beneOptionActive]}
                  onPress={() => setBeneficiaryId(b.id)}
                >
                  <Text style={[styles.beneOptionText, beneficiaryId === b.id && { color: "#fff" }]}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormField
              label="Amount (₦)"
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Type</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                    <Text style={[styles.chipText, type === t && { color: "#fff" }]}>
                      {TYPE_META[t].icon} {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button title="+ Add to Batch" variant="outline" onPress={addRow} />

            {rows.length > 0 && (
              <Text style={styles.batchHeading}>Batch ({rows.length})</Text>
            )}
          </View>
        }
        renderItem={({ item: r }) => (
          <View style={styles.rowCard}>
            <View style={styles.rowAvatar}>
              <Text style={styles.rowAvatarText}>{r.beneName?.[0] || "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{r.beneName}</Text>
              <Text style={styles.rowType}>{r.type}</Text>
            </View>
            <Text style={styles.rowAmount}>{NGN(r.amount)}</Text>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeRow(r.id)}>
              <Text style={{ color: COLORS.red, fontSize: 12 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          rows.length > 0 ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total ({rows.length} payments)</Text>
                <Text style={styles.totalAmount}>{NGN(total)}</Text>
              </View>
              <Button
                title={!hasBank ? "Link a bank to continue" : `Authorise ${rows.length} Payments →`}
                onPress={submitBatch}
                disabled={!hasBank}
                loading={bulkMut.isPending}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  infoBox: { backgroundColor: COLORS.bluePale, borderWidth: 1, borderColor: "#c8d8f0", borderRadius: 12, padding: 12 },
  infoText: { fontSize: 12, color: COLORS.blue, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  beneOption: { padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  beneOptionActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  beneOptionText: { fontSize: 13, color: COLORS.text },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  batchHeading: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  rowCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 11, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8,
  },
  rowAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.greenPale, alignItems: "center", justifyContent: "center" },
  rowAvatarText: { fontSize: 12, fontWeight: "700", color: COLORS.green },
  rowName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  rowType: { fontSize: 11, color: COLORS.muted },
  rowAmount: { fontSize: 13, fontWeight: "700", color: COLORS.green },
  removeBtn: { backgroundColor: COLORS.redPale, borderRadius: 13, width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  totalBox: { backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  totalAmount: { fontSize: 17, fontWeight: "700", color: COLORS.green },
});
