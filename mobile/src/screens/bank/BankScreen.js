import React, { useState }             from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser                           from "expo-web-browser";
import { COLORS }                                from "../../theme";
import { UsersAPI }                              from "../../api/users";
import { apiErrorMessage }                       from "../../api/client";
import { useToast }                              from "../../context/ToastContext";
import ScreenHeader                              from "../../components/ScreenHeader";
import Button                                    from "../../components/Button";

// ── Card type colours ────────────────────────────────────────────────────────
function cardColor(type = "") {
  const t = type.toLowerCase();
  if (t.includes("visa"))       return "#1a1f71";
  if (t.includes("mastercard")) return "#eb001b";
  if (t.includes("verve"))      return "#007b5e";
  return "#333";
}

function cardInitials(type = "") {
  const t = type.toLowerCase();
  if (t.includes("visa"))       return "VISA";
  if (t.includes("mastercard")) return "MC";
  if (t.includes("verve"))      return "VRV";
  return "CARD";
}

// ── Card icon component ──────────────────────────────────────────────────────
function CardBadge({ type }) {
  return (
    <View style={[styles.cardIcon, { backgroundColor: cardColor(type) }]}>
      <Text style={styles.cardIconText}>{cardInitials(type)}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function BankScreen({ navigation }) {
  const { showToast }  = useToast();
  const queryClient    = useQueryClient();
  const [linking, setLinking] = useState(false);

  const accountsQ = useQuery({
    queryKey: ["bankAccounts"],
    queryFn:  UsersAPI.bankAccounts,
  });

  // ── Unlink mutation ────────────────────────────────────────────────────────
  const unlinkMut = useMutation({
    mutationFn: (id) => UsersAPI.unlinkBankAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      showToast("Card removed");
    },
    onError: (e) => showToast(apiErrorMessage(e, "Could not remove card"), "error"),
  });

  // ── Set default mutation ───────────────────────────────────────────────────
  const defaultMut = useMutation({
    mutationFn: (id) => UsersAPI.setDefaultAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      showToast("Default card updated");
    },
    onError: (e) => showToast(apiErrorMessage(e, "Could not update default"), "error"),
  });

  // ── Link card flow ─────────────────────────────────────────────────────────
  async function handleLinkCard() {
    setLinking(true);
    try {
      const { checkoutUrl } = await UsersAPI.initiateLinkFee();

      await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: "done",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });

      showToast("Checking for linked card…");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      }, 2000);

    } catch (e) {
      showToast(apiErrorMessage(e, "Could not start card linking"), "error");
    } finally {
      setLinking(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const accounts = accountsQ.data ?? [];
  const isLoading = accountsQ.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="Linked Cards" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoTitle}>💳 How card linking works</Text>
          <Text style={styles.infoBody}>
            AutoPay charges a one-time ₦50 fee to your debit card. This verifies your card
            and saves it for future scheduled payment debits — no manual account number needed.
          </Text>
        </View>

        {/* ── Linked cards ── */}
        {isLoading ? (
          <ActivityIndicator color={COLORS.green} style={{ marginVertical: 24 }} />
        ) : accounts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No card linked yet</Text>
            <Text style={styles.emptyBody}>
              Link a debit card below to start scheduling payments.
            </Text>
          </View>
        ) : (
          accounts.map((acc) => (
            <View key={acc.id} style={styles.cardRow}>
              <CardBadge type={acc.paystackChannelType} />

              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>
                  {acc.bankName}
                  {acc.isDefault ? "  ✦ Default" : ""}
                </Text>
                <Text style={styles.cardSub}>
                  •••• •••• •••• {acc.paystackLast4 ?? acc.accountNumber?.slice(-4)}
                </Text>
                <Text style={styles.cardSub}>
                  Exp {acc.paystackExpMonth}/{acc.paystackExpYear}
                </Text>
              </View>

              <View style={styles.cardActions}>
                {!acc.isDefault && (
                  <TouchableOpacity
                    onPress={() => defaultMut.mutate(acc.id)}
                    disabled={defaultMut.isPending}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => unlinkMut.mutate(acc.id)}
                  disabled={unlinkMut.isPending}
                  style={[styles.actionBtn, styles.removeBtn]}
                >
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* ── Link card button ── */}
        <View style={styles.linkSection}>
          <Button
            title={linking ? "Opening Paystack…" : "＋ Link Debit Card  (₦50 one-time)"}
            onPress={handleLinkCard}
            loading={linking}
            disabled={linking}
          />
          <Text style={styles.linkHint}>
            🔒 Secured by Paystack. Your card details are never stored on AutoPay's servers.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap:     14,
    flexGrow: 1,
  },

  infoBanner: {
    backgroundColor: COLORS.greenPale,
    borderWidth:     1,
    borderColor:     COLORS.greenDim,
    borderRadius:    14,
    padding:         14,
    gap:             6,
  },
  infoTitle: {
    fontSize:   13,
    fontWeight: "700",
    color:      COLORS.green,
  },
  infoBody: {
    fontSize:   12,
    color:      COLORS.green,
    lineHeight: 18,
  },

  emptyBox: {
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 40,
    gap:             8,
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  emptyBody:  { fontSize: 13, color: COLORS.muted2, textAlign: "center" },

  cardRow: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             12,
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    14,
    padding:         14,
  },
  cardIcon: {
    width:          44,
    height:         28,
    borderRadius:   5,
    alignItems:     "center",
    justifyContent: "center",
  },
  cardIconText: {
    fontSize:   10,
    fontWeight: "900",
    color:      "#fff",
    letterSpacing: 0.5,
  },
  cardName: {
    fontSize:   14,
    fontWeight: "600",
    color:      COLORS.text,
  },
  cardSub: {
    fontSize:  12,
    color:     COLORS.muted2,
    marginTop: 2,
  },
  cardActions: {
    alignItems: "flex-end",
    gap:        6,
  },
  actionBtn: {
    paddingVertical:   4,
    paddingHorizontal: 10,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  actionBtnText: {
    fontSize:   11,
    fontWeight: "600",
    color:      COLORS.green,
  },
  removeBtn:     { borderColor: "#e53e3e" },
  removeBtnText: { fontSize: 11, fontWeight: "600", color: "#e53e3e" },

  linkSection: {
    marginTop: 8,
    gap:       10,
  },
  linkHint: {
    fontSize:  11,
    color:     COLORS.muted2,
    textAlign: "center",
    lineHeight: 16,
  },
});
