import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, bankColor, bankInitials } from "../../theme";
import { UsersAPI } from "../../api/users";
import { fetchBanks } from "../../api/resources";
import { apiErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import ScreenHeader from "../../components/ScreenHeader";
import FormField from "../../components/FormField";
import Button from "../../components/Button";
import Badge from "../../components/Badge";

export default function BankScreen({ navigation }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBank, setSelectedBank] = useState(null);
  const [acctNum, setAcctNum] = useState("");

  const accountsQ = useQuery({ queryKey: ["bankAccounts"], queryFn: UsersAPI.bankAccounts });
  const banksQ = useQuery({ queryKey: ["banks"], queryFn: fetchBanks, staleTime: Infinity });

  const linkMut = useMutation({
    mutationFn: (payload) => UsersAPI.linkBank(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      showToast(`${selectedBank.name} linked ✓`);
      navigation.goBack();
    },
    onError: (e) => showToast(apiErrorMessage(e, "Could not verify account"), "error"),
  });

  const banks = banksQ.data || [];
  const filtered = search ? banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase())) : banks;

  function linkBank() {
    if (!selectedBank || acctNum.length !== 10) {
      showToast("Fill in all fields", "error");
      return;
    }
    linkMut.mutate({ bankName: selectedBank.name, bankCode: selectedBank.code, accountNumber: acctNum });
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="Link Bank Account" onBack={() => navigation.goBack()} />
      <FlatList
        data={filtered.slice(0, 30)}
        keyExtractor={(b) => b.code}
        contentContainerStyle={{ padding: 16, gap: 0 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={styles.secureBox}>
              <Text style={styles.secureText}>
                🔒 Your account is verified via Paystack's secure name-enquiry API. No credentials stored.
              </Text>
            </View>

            {(accountsQ.data || []).map((acc) => (
              <View key={acc.id} style={styles.linkedCard}>
                <View style={[styles.avatar, { backgroundColor: bankColor(acc.bankName) }]}>
                  <Text style={styles.avatarText}>{bankInitials(acc.bankName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkedBankName}>{acc.bankName}</Text>
                  <Text style={styles.linkedSub}>
                    ···{acc.accountNumber?.slice(-4)} · {acc.accountName}
                  </Text>
                </View>
                {acc.isDefault && <Badge label="DEFAULT" tone="neutral" />}
              </View>
            ))}

            <FormField
              label="Search Bank"
              placeholder="e.g. Access Bank"
              value={search}
              onChangeText={setSearch}
              hint={banksQ.isLoading ? "Loading banks..." : `${banks.length} banks loaded`}
            />
          </View>
        }
        renderItem={({ item: b }) => (
          <TouchableOpacity
            style={[styles.bankRow, selectedBank?.code === b.code && styles.bankRowSelected]}
            onPress={() => setSelectedBank(b)}
          >
            <View style={[styles.bankIcon, { backgroundColor: bankColor(b.name) }]}>
              <Text style={styles.bankIconText}>{bankInitials(b.name)}</Text>
            </View>
            <Text style={styles.bankName}>{b.name}</Text>
            {selectedBank?.code === b.code && <Text style={{ color: COLORS.green, fontSize: 16 }}>✓</Text>}
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={{ marginTop: 14, gap: 14 }}>
            {selectedBank && (
              <FormField
                label="Account Number"
                placeholder="0000000000"
                keyboardType="number-pad"
                maxLength={10}
                value={acctNum}
                onChangeText={(v) => setAcctNum(v.replace(/\D/g, ""))}
                hint="Your 10-digit NUBAN account number"
              />
            )}
            <Button
              title="Link Account via Paystack →"
              onPress={linkBank}
              loading={linkMut.isPending}
              disabled={!selectedBank || acctNum.length !== 10}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  secureBox: { backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim, borderRadius: 12, padding: 12 },
  secureText: { fontSize: 12, color: COLORS.green, lineHeight: 18 },
  linkedCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    padding: 13, flexDirection: "row", alignItems: "center", gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  linkedBankName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  linkedSub: { fontSize: 12, color: COLORS.muted2, marginTop: 1 },
  bankRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 6, backgroundColor: COLORS.surface,
  },
  bankRowSelected: { borderColor: COLORS.green, backgroundColor: COLORS.greenPale },
  bankIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bankIconText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  bankName: { flex: 1, fontSize: 13, fontWeight: "500", color: COLORS.text },
});
