import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, RADIUS, bankColor, bankInitials } from "../../theme";
import { BeneficiariesAPI, fetchBanks } from "../../api/resources";
import { apiErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import FormField from "../../components/FormField";
import Button from "../../components/Button";
import Badge from "../../components/Badge";

export default function BeneficiariesScreen({ navigation }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);

  const beneQ = useQuery({ queryKey: ["beneficiaries"], queryFn: BeneficiariesAPI.list });
  const banksQ = useQuery({ queryKey: ["banks"], queryFn: fetchBanks, staleTime: Infinity });

  const removeMut = useMutation({
    mutationFn: (id) => BeneficiariesAPI.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      showToast("Recipient removed");
    },
    onError: (e) => showToast(apiErrorMessage(e), "error"),
  });

  function confirmDelete(b) {
    Alert.alert("Remove Recipient", `Remove ${b.name}? This can't be undone if no active schedules.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeMut.mutate(b.id) },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader
        title="Recipients"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        }
      />
      <FlatList
        data={beneQ.data || []}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="No recipients yet"
            subtitle="Add people and businesses you pay regularly to get started."
            actionLabel="+ Add Recipient"
            onAction={() => setModalVisible(true)}
          />
        }
        renderItem={({ item: b }) => (
          <View style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: bankColor(b.bank || "") }]}>
              <Text style={styles.avatarText}>{bankInitials(b.name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
              <Text style={styles.sub}>
                {b.bank} · ···{b.accountNumber?.slice(-4)}
              </Text>
              {b._count?.schedules > 0 && (
                <Badge label={`${b._count.schedules} active`} tone="neutral" style={{ marginTop: 4 }} />
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title="Pay"
                small
                variant="outline"
                onPress={() => navigation.navigate("Schedule")}
              />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(b)}>
                <Text style={{ color: COLORS.red, fontSize: 13 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <AddBeneficiaryModal
        visible={modalVisible}
        banks={banksQ.data || []}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
          showToast("Recipient saved ✓");
        }}
      />
    </View>
  );
}

function AddBeneficiaryModal({ visible, banks, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", bank: "", bankCode: "", accountNumber: "", note: "" });
  const [bankSearch, setBankSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [errors, setErrors] = useState({});

  const createMut = useMutation({
    mutationFn: (payload) => BeneficiariesAPI.create(payload),
    onSuccess: () => {
      setForm({ name: "", bank: "", bankCode: "", accountNumber: "", note: "" });
      onSuccess();
    },
    onError: (e) => showToast(apiErrorMessage(e, "Could not verify account"), "error"),
  });

  const filtered = bankSearch ? banks.filter((b) => b.name.toLowerCase().includes(bankSearch.toLowerCase())) : banks;

  function save() {
    const e = {};
    if (!form.name) e.name = "Name required";
    if (!form.bankCode) e.bank = "Select a bank";
    if (form.accountNumber.length !== 10) e.acct = "Enter a 10-digit account number";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    createMut.mutate({
      name: form.name,
      bank: form.bank,
      bankCode: form.bankCode,
      accountNumber: form.accountNumber,
      note: form.note || undefined,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Add Recipient</Text>
            <Text style={styles.modalSub}>Verified via Paystack. Account name will be confirmed.</Text>

            <FormField
              label="Display Name"
              placeholder="Chidi Landlord"
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              error={errors.name}
            />

            <View style={{ gap: 6, marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Bank</Text>
              <FormField
                placeholder="Search bank..."
                value={bankSearch || form.bank}
                onFocus={() => setShowDrop(true)}
                onChangeText={(v) => {
                  setBankSearch(v);
                  setShowDrop(true);
                }}
                error={errors.bank}
              />
              {showDrop && filtered.length > 0 && (
                <View style={styles.dropdown}>
                  {filtered.slice(0, 12).map((b) => (
                    <TouchableOpacity
                      key={b.code}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setForm((p) => ({ ...p, bank: b.name, bankCode: b.code }));
                        setBankSearch("");
                        setShowDrop(false);
                      }}
                    >
                      <Text style={{ fontSize: 13 }}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={{ marginTop: 14 }}>
              <FormField
                label="Account Number"
                placeholder="0000000000"
                keyboardType="number-pad"
                maxLength={10}
                value={form.accountNumber}
                onChangeText={(v) => setForm((p) => ({ ...p, accountNumber: v.replace(/\D/g, "") }))}
                error={errors.acct}
              />
            </View>

            <View style={{ marginTop: 14, marginBottom: 18 }}>
              <FormField
                label="Note (optional)"
                placeholder="e.g. Office landlord"
                value={form.note}
                onChangeText={(v) => setForm((p) => ({ ...p, note: v }))}
              />
            </View>

            <Button title="Save Recipient" onPress={save} loading={createMut.isPending} />
            <View style={{ height: 10 }} />
            <Button title="Cancel" variant="outline" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 20, backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim },
  addBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.green },
  card: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16,
    padding: 13, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  name: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  sub: { fontSize: 11, color: COLORS.muted2, marginTop: 2 },
  deleteBtn: { backgroundColor: COLORS.redPale, borderRadius: 15, width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(12,20,12,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: "88%" },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontFamily: "DMSerifDisplay", fontSize: 21, color: COLORS.dark, marginBottom: 6 },
  modalSub: { fontSize: 13, color: COLORS.muted, marginBottom: 18, lineHeight: 19 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  dropdown: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, maxHeight: 160 },
  dropdownItem: { paddingVertical: 9, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
});
