import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import { COLORS, RADIUS, TYPE_META, FREQ_LABEL } from "../../theme";
import { NGN, fmtDate } from "../../utils/format";
import { BeneficiariesAPI, SchedulesAPI } from "../../api/resources";
import { UsersAPI } from "../../api/users";
import ScreenHeader from "../../components/ScreenHeader";
import FormField from "../../components/FormField";
import Button from "../../components/Button";

const TYPES = Object.keys(TYPE_META);
const FREQS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export default function ScheduleScreen({ navigation }) {
  const beneQ = useQuery({ queryKey: ["beneficiaries"], queryFn: BeneficiariesAPI.list });
  const bankQ = useQuery({ queryKey: ["bankAccounts"], queryFn: UsersAPI.bankAccounts });

  const [type, setType] = useState("Rent");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});

  const beneficiary = beneQ.data?.find((b) => b.id === beneficiaryId);
  const accounts = bankQ.data || [];
  const hasBank = accounts.length > 0;
  const hasActiveMandate = accounts.some((a) => a.mandateStatus === "active");

  function validateAndContinue() {
    const e = {};
    if (!beneficiaryId) e.beneficiary = "Select a recipient";
    if (!amount || parseFloat(amount) < 100) e.amount = "Minimum ₦100";
    if (!date) e.date = "Select a date";
    if (!hasBank) e.bank = "Link a bank account first";
    else if (!hasActiveMandate) e.bank = "Authorise direct debit on your bank account before scheduling";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    navigation.navigate("ScheduleConfirm", {
      payload: {
        type,
        beneficiaryId,
        beneficiaryName: beneficiary?.name,
        amount: parseFloat(amount),
        frequency,
        startDate: date,
        note,
      },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="New Schedule" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {errors.bank && (
          <View style={styles.errBanner}>
            <Text style={styles.errBannerText}>{errors.bank}</Text>
            <Text style={styles.errBannerLink} onPress={() => navigation.navigate("Bank")}>
              Link now →
            </Text>
          </View>
        )}

        <View style={styles.group}>
          <Text style={styles.label}>Payment Type</Text>
          <View style={styles.chipsWrap}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={[styles.chip, type === t && styles.chipActive]}
              >
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                  {TYPE_META[t].icon} {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Recipient</Text>
          <View style={[styles.pickerWrap, errors.beneficiary && styles.pickerError]}>
            <Picker
              selectedValue={beneficiaryId}
              onValueChange={(v) => {
                setBeneficiaryId(v);
                setErrors((p) => ({ ...p, beneficiary: "" }));
              }}
            >
              <Picker.Item label="Select a recipient" value="" />
              {(beneQ.data || []).map((b) => (
                <Picker.Item key={b.id} label={`${b.name} · ${b.bank}`} value={b.id} />
              ))}
            </Picker>
          </View>
          {errors.beneficiary ? <Text style={styles.fieldError}>{errors.beneficiary}</Text> : null}
          <Text style={styles.addLink} onPress={() => navigation.navigate("Beneficiaries")}>
            + Add a new recipient
          </Text>
        </View>

        <FormField
          label="Amount (₦)"
          placeholder="0.00"
          keyboardType="numeric"
          value={amount}
          onChangeText={(v) => {
            setAmount(v.replace(/[^0-9.]/g, ""));
            setErrors((p) => ({ ...p, amount: "" }));
          }}
          error={errors.amount}
        />

        <View style={styles.row2}>
          <View style={[styles.group, { flex: 1 }]}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={frequency} onValueChange={setFrequency}>
                {FREQS.map((f) => (
                  <Picker.Item key={f} label={FREQ_LABEL[f]} value={f} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <FormField
          label="First Payment Date (YYYY-MM-DD)"
          placeholder="2026-08-01"
          value={date}
          onChangeText={(v) => {
            setDate(v);
            setErrors((p) => ({ ...p, date: "" }));
          }}
          error={errors.date}
        />

        <FormField label="Note (optional)" placeholder="e.g. June rent" value={note} onChangeText={setNote} />

        {beneficiaryId && amount && date && (
          <View style={styles.summary}>
            <Text style={styles.summaryHeader}>Payment Summary</Text>
            {[
              ["Recipient", beneficiary?.name || "—"],
              ["Amount", NGN(parseFloat(amount || 0))],
              ["Frequency", FREQ_LABEL[frequency]],
              ["First Payment", fmtDate(date)],
            ].map(([l, v]) => (
              <View key={l} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{l}</Text>
                <Text style={styles.summaryValue}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        <Button title="Review & Confirm →" onPress={validateAndContinue} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, gap: 16, paddingBottom: 40 },
  errBanner: {
    backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: "#f0c8c8", borderRadius: 10,
    padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  errBannerText: { fontSize: 13, color: COLORS.red, flex: 1 },
  errBannerLink: { fontSize: 13, color: COLORS.blue, fontWeight: "700" },
  group: { gap: 8 },
  label: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  chipTextActive: { color: "#fff" },
  pickerWrap: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, overflow: "hidden" },
  pickerError: { borderColor: COLORS.red },
  fieldError: { fontSize: 12, color: COLORS.red },
  addLink: { fontSize: 12, color: COLORS.green, fontWeight: "600" },
  row2: { flexDirection: "row", gap: 12 },
  summary: { backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim, borderRadius: 18, padding: 16 },
  summaryHeader: { fontSize: 11, fontWeight: "700", color: COLORS.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 9 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.greenDim },
  summaryLabel: { fontSize: 13, color: COLORS.muted },
  summaryValue: { fontSize: 13, fontWeight: "600", color: COLORS.text },
});
