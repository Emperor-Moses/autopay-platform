import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { COLORS } from "../theme";
import { AuthAPI } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import Button from "./Button";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

// Steps: "intro" -> "create" -> "confirm" -> "password"
export default function SetPinModal({ visible, onClose, onSuccess }) {
  const [step, setStep] = useState("create");
  const [newPin, setNewPin] = useState([]);
  const [confirmPin, setConfirmPin] = useState([]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("create");
    setNewPin([]);
    setConfirmPin([]);
    setPassword("");
    setError("");
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pressCreate(k) {
    if (k === "⌫") return setNewPin((d) => d.slice(0, -1));
    if (newPin.length >= 4) return;
    const next = [...newPin, k];
    setNewPin(next);
    if (next.length === 4) {
      setTimeout(() => setStep("confirm"), 250);
    }
  }

  function pressConfirm(k) {
    if (k === "⌫") return setConfirmPin((d) => d.slice(0, -1));
    if (confirmPin.length >= 4) return;
    const next = [...confirmPin, k];
    setConfirmPin(next);
    if (next.length === 4) {
      if (next.join("") !== newPin.join("")) {
        setError("PINs don't match — let's try again");
        setTimeout(() => {
          setNewPin([]);
          setConfirmPin([]);
          setError("");
          setStep("create");
        }, 900);
        return;
      }
      setError("");
      setStep("password");
    }
  }

  async function handleSubmitPassword() {
    if (!password) {
      setError("Enter your account password to confirm");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await AuthAPI.setPin({ pin: newPin.join(""), currentPassword: password });
      setSubmitting(false);
      reset();
      onSuccess();
    } catch (err) {
      setSubmitting(false);
      setError(apiErrorMessage(err, "Could not set PIN. Please check your password."));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {step === "create" && (
            <>
              <Text style={styles.title}>Create Your PIN</Text>
              <Text style={styles.subtitle}>This is your first schedule — set a 4-digit PIN to authorise future payments</Text>
              <Dots digits={newPin} error={false} />
              <Keypad onPress={pressCreate} disabled={false} keys={KEYS} />
            </>
          )}

          {step === "confirm" && (
            <>
              <Text style={styles.title}>Confirm Your PIN</Text>
              <Text style={styles.subtitle}>Enter the same 4 digits again</Text>
              <Dots digits={confirmPin} error={!!error} />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Keypad onPress={pressConfirm} disabled={!!error} keys={KEYS} />
            </>
          )}

          {step === "password" && (
            <>
              <Text style={styles.title}>Confirm Your Password</Text>
              <Text style={styles.subtitle}>Enter your account password to finish setting your PIN</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TextInput
                style={styles.passwordInput}
                placeholder="Account password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <Button
                title={submitting ? "Saving…" : "Save PIN & Continue"}
                onPress={handleSubmitPassword}
                disabled={submitting}
                style={{ marginTop: 14 }}
              />
            </>
          )}

          <Button title="Cancel" variant="outline" onPress={handleClose} style={{ marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}

function Dots({ digits, error }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { borderColor: error ? COLORS.red : digits.length > i ? COLORS.green : COLORS.border },
            digits.length > i && { backgroundColor: error ? COLORS.red : COLORS.green },
          ]}
        />
      ))}
    </View>
  );
}

function Keypad({ onPress, disabled, keys }) {
  return (
    <View style={styles.keypad}>
      {keys.map((k, i) => (
        <TouchableOpacity
          key={i}
          style={styles.key}
          disabled={k === "" || disabled}
          onPress={() => onPress(k)}
          activeOpacity={0.6}
        >
          <Text style={styles.keyText}>{k}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(12,20,12,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 14 },
  title: { fontFamily: "DMSerifDisplay", fontSize: 19, textAlign: "center", color: COLORS.dark },
  subtitle: { fontSize: 12, color: COLORS.muted, textAlign: "center", marginTop: 4, paddingHorizontal: 10 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 14 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2.5 },
  errorText: { textAlign: "center", fontSize: 12, fontWeight: "600", color: COLORS.red, marginBottom: 4 },
  keypad: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6 },
  key: { width: "33.33%", height: 58, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 22, fontWeight: "600", color: COLORS.dark },
  passwordInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: COLORS.dark, marginTop: 16,
  },
});
