import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { UsersAPI } from "../../api/users";
import { apiErrorMessage } from "../../api/client";
import Badge from "../../components/Badge";
import Button from "../../components/Button";

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: UsersAPI.me });
  const bankQ = useQuery({ queryKey: ["bankAccounts"], queryFn: UsersAPI.bankAccounts });
  const beneQ = useQuery({ queryKey: ["beneficiaries"], queryFn: () => UsersAPI.bankAccounts() });

  const settings = profileQ.data?.settings || { reminders: true, balance: true, confirmations: true };

  const updateSettingsMut = useMutation({
    mutationFn: (payload) => UsersAPI.updateSettings(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => showToast(apiErrorMessage(e), "error"),
  });

  const deleteMut = useMutation({
    mutationFn: UsersAPI.deleteMe,
    onSuccess: () => logout(),
    onError: (e) => showToast(apiErrorMessage(e), "error"),
  });

  function toggle(key) {
    updateSettingsMut.mutate({ ...settings, [key]: !settings[key] });
  }

  function confirmDelete() {
    Alert.alert("Delete Account", "This will deactivate your account and sign you out. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() },
    ]);
  }

  const defaultBank = bankQ.data?.find((b) => b.isDefault) || bankQ.data?.[0];
  const name = user?.name || "—";

  const sections = [
    {
      heading: "Payment",
      rows: [
        { label: "Linked Bank", sub: defaultBank ? `${defaultBank.bankName} · ···${defaultBank.accountNumber?.slice(-4)}` : "No account linked", icon: "🏦", onPress: () => navigation.navigate("Bank") },
        { label: "Recipients", sub: "Manage saved recipients", icon: "👥", onPress: () => navigation.navigate("Beneficiaries") },
        { label: "Analytics", sub: "View spending insights", icon: "📊", onPress: () => navigation.navigate("Analytics") },
      ],
    },
    {
      heading: "Notifications",
      rows: [
        { label: "24h Reminders", sub: "Get notified before each payment", icon: "🔔", toggleKey: "reminders" },
        { label: "Low Balance Alerts", sub: "Alert when balance is insufficient", icon: "⚠️", toggleKey: "balance" },
        { label: "Payment Confirmations", sub: "Receipt after each payment", icon: "✅", toggleKey: "confirmations" },
      ],
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={["#0b1a0b", "#1a3822"]} style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileEmail}>{user?.email || "—"}</Text>
          <Badge label="Beta Member" tone="neutral" style={{ marginTop: 7, backgroundColor: "rgba(46,220,114,0.15)" }} />
        </View>
      </LinearGradient>

      <View style={{ padding: 14 }}>
        {sections.map((sec) => (
          <View key={sec.heading}>
            <Text style={styles.sectionHeading}>{sec.heading}</Text>
            {sec.rows.map((row) => (
              <TouchableOpacity
                key={row.label}
                style={styles.row}
                onPress={row.toggleKey ? () => toggle(row.toggleKey) : row.onPress}
                activeOpacity={row.toggleKey ? 1 : 0.7}
              >
                <Text style={styles.rowIcon}>{row.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowSub}>{row.sub}</Text>
                </View>
                {row.toggleKey ? (
                  <Switch
                    value={!!settings[row.toggleKey]}
                    onValueChange={() => toggle(row.toggleKey)}
                    trackColor={{ true: COLORS.green, false: COLORS.border }}
                  />
                ) : (
                  <Text style={{ color: COLORS.muted2, fontSize: 16 }}>›</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={{ marginTop: 16, gap: 9 }}>
          <Button title="Sign Out" variant="outline" onPress={logout} />
          <Button title="Delete Account" variant="dangerSoft" onPress={confirmDelete} loading={deleteMut.isPending} />
        </View>

        <Text style={styles.footer}>AutoPay Platform Beta v0.1 · Powered by Paystack · NDPA</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileCard: { margin: 14, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(46,220,114,0.15)", borderWidth: 2, borderColor: "rgba(46,220,114,0.3)", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: COLORS.greenLt },
  profileName: { fontSize: 16, fontWeight: "600", color: "#eef5ee" },
  profileEmail: { fontSize: 12, color: "#6a8a6a", marginTop: 2 },
  sectionHeading: { fontSize: 10, fontWeight: "700", color: COLORS.muted2, textTransform: "uppercase", letterSpacing: 1, paddingVertical: 12, paddingHorizontal: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, padding: 13, marginBottom: 8,
  },
  rowIcon: { fontSize: 18, width: 30, textAlign: "center" },
  rowLabel: { fontSize: 13, fontWeight: "500", color: COLORS.text },
  rowSub: { fontSize: 11, color: COLORS.muted2, marginTop: 1 },
  footer: { textAlign: "center", fontSize: 11, color: COLORS.muted2, marginTop: 18 },
});
