import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { COLORS } from "../../theme";
import { NGN, fmtDate } from "../../utils/format";
import { FREQ_LABEL } from "../../theme";
import { SchedulesAPI } from "../../api/resources";
import { AuthAPI } from "../../api/auth";
import { apiErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import Button from "../../components/Button";
import PinModal from "../../components/PinModal";
import SetPinModal from "../../components/SetPinModal";

export default function ScheduleConfirmScreen({ route, navigation }) {
  const { payload } = route.params;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const [pinVisible, setPinVisible] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);

  function handleAuthorisePress() {
    if (!user?.hasPin) {
      setShowSetPin(true);
    } else {
      setPinVisible(true);
    }
  }

  async function createSchedule() {
    const schedule = await SchedulesAPI.create(payload);
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    navigation.replace("ScheduleSuccess", { schedule, payload });
  }

  async function handlePinSubmit(pin) {
    setVerifying(true);
    setPinError("");
    try {
      // verifyPin returns a raw boolean from the API — do not destructure it
      const ok = await AuthAPI.verifyPin(pin);
      if (ok !== true) {
        setPinError("Incorrect PIN");
        setVerifying(false);
        return;
      }
      await createSchedule();
      setVerifying(false);
      setPinVisible(false);
    } catch (err) {
      setVerifying(false);
      setPinError(apiErrorMessage(err, "Could not create schedule"));
    }
  }

  async function handlePinCreated() {
    setShowSetPin(false);
    await refreshProfile();
    try {
      await createSchedule();
    } catch (err) {
      showToast(apiErrorMessage(err, "Could not create schedule"), "error");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView>
        <LinearGradient colors={["#0b1a0b", "#1a3822"]} style={styles.header}>
          <Text style={styles.headerLabel}>Scheduling Payment</Text>
          <Text style={styles.headerAmount}>{NGN(payload.amount)}</Text>
          <Text style={styles.headerSub}>to {payload.beneficiaryName || "recipient"}</Text>
        </LinearGradient>

        <View style={styles.details}>
          {[
            ["Recipient", payload.beneficiaryName || "—"],
            ["Payment Type", payload.type],
            ["Frequency", FREQ_LABEL[payload.frequency]],
            ["First Payment", fmtDate(payload.startDate)],
            ...(payload.note ? [["Note", payload.note]] : []),
          ].map(([l, v]) => (
            <View key={l} style={styles.row}>
              <Text style={styles.rowLabel}>{l}</Text>
              <Text style={styles.rowValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            ⚠️ AutoPay will debit your account on the scheduled date. You'll get a 24h reminder before each payment.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="🔐 Authorise with PIN →" onPress={handleAuthorisePress} />
          <Button title="Go Back" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>

      <PinModal
        visible={pinVisible}
        amount={payload.amount}
        error={pinError}
        verifying={verifying}
        onSubmit={handlePinSubmit}
        onClose={() => {
          setPinVisible(false);
          setPinError("");
        }}
      />

      <SetPinModal
        visible={showSetPin}
        onClose={() => setShowSetPin(false)}
        onSuccess={handlePinCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: 28, paddingHorizontal: 22, alignItems: "center" },
  headerLabel: { fontSize: 11, color: "#6a8a6a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 },
  headerAmount: { fontFamily: "DMSerifDisplay", fontSize: 44, color: "#fff", marginBottom: 4 },
  headerSub: { fontSize: 14, color: "#a0c0a0" },
  details: { paddingHorizontal: 18, paddingTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { fontSize: 13, color: COLORS.muted },
  rowValue: { fontSize: 13, fontWeight: "600", color: COLORS.text, textAlign: "right" },
  warnBox: { margin: 18, backgroundColor: COLORS.goldPale, borderWidth: 1, borderColor: "#f0d8b0", borderRadius: 12, padding: 13 },
  warnText: { fontSize: 12, color: "#8a5a1a", lineHeight: 18 },
  actions: { paddingHorizontal: 18, gap: 10, paddingBottom: 30 },
});
