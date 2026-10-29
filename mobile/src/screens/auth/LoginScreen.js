import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import FormField from "../../components/FormField";
import Button from "../../components/Button";
import ScreenHeader from "../../components/ScreenHeader";

const BIO_EMAIL_KEY = "autopay_bio_email";
const BIO_PASSWORD_KEY = "autopay_bio_password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const { login, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("demo@autopay.ng");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Biometrics
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometrics");
  const [bioIcon, setBioIcon] = useState("finger-print");
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [enableBio, setEnableBio] = useState(false);

  // Forgot password
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !enrolled) return;

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const T = LocalAuthentication.AuthenticationType;
        if (types.includes(T.FACIAL_RECOGNITION)) {
          setBioLabel(Platform.OS === "ios" ? "Face ID" : "Face unlock");
          setBioIcon("scan");
        } else if (types.includes(T.FINGERPRINT)) {
          setBioLabel(Platform.OS === "ios" ? "Touch ID" : "Fingerprint");
          setBioIcon("finger-print");
        }
        setBioAvailable(true);

        const saved = await SecureStore.getItemAsync(BIO_EMAIL_KEY);
        setHasSavedLogin(!!saved);
        setEnableBio(!!saved);
      } catch {
        // Biometrics unavailable: password login still works.
      }
    })();
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      setError("Fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const res = await login(email, password);

    if (res.ok && bioAvailable) {
      try {
        if (enableBio) {
          await SecureStore.setItemAsync(BIO_EMAIL_KEY, email);
          await SecureStore.setItemAsync(BIO_PASSWORD_KEY, password);
        } else {
          await SecureStore.deleteItemAsync(BIO_EMAIL_KEY);
          await SecureStore.deleteItemAsync(BIO_PASSWORD_KEY);
        }
      } catch {
        // Not being able to save biometric login shouldn't block sign in.
      }
    }

    setLoading(false);
    if (!res.ok) setError(res.error);
  }

  async function handleBiometricLogin() {
    setError("");
    try {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to AutoPay",
        cancelLabel: "Use password",
      });
      if (!auth.success) return; // cancelled or failed; user can use the password

      const savedEmail = await SecureStore.getItemAsync(BIO_EMAIL_KEY);
      const savedPassword = await SecureStore.getItemAsync(BIO_PASSWORD_KEY);
      if (!savedEmail || !savedPassword) {
        setHasSavedLogin(false);
        setError(`Sign in with your password once to turn on ${bioLabel}.`);
        return;
      }

      setLoading(true);
      const res = await login(savedEmail, savedPassword);
      setLoading(false);
      if (!res.ok) {
        // Saved password is no longer valid (e.g. it was reset), so clear it.
        await SecureStore.deleteItemAsync(BIO_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIO_PASSWORD_KEY);
        setHasSavedLogin(false);
        setEnableBio(false);
        setError("Your saved login has expired. Sign in with your password.");
      }
    } catch {
      setLoading(false);
      setError(`${bioLabel} isn't working right now. Sign in with your password.`);
    }
  }

  function openReset() {
    setResetEmail(email);
    setResetError("");
    setResetSent(false);
    setResetVisible(true);
  }

  function closeReset() {
    setResetVisible(false);
  }

  async function handleSendReset() {
    const trimmed = resetEmail.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setResetError("Enter a valid email address");
      return;
    }
    if (typeof requestPasswordReset !== "function") {
      setResetError("Password reset isn't set up yet. Contact support.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    const res = await requestPasswordReset(trimmed);
    setResetLoading(false);
    if (res && res.ok === false) {
      setResetError(res.error || "Couldn't send the reset link. Try again.");
      return;
    }
    setResetSent(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Sign In" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Welcome{"\n"}back.</Text>
        <Text style={styles.sub}>Sign in to manage your scheduled payments.</Text>

        <View style={styles.demoBox}>
          <Text style={styles.demoText}>
            <Text style={{ fontWeight: "700" }}>Demo:</Text> demo@autopay.ng / password123 · PIN: 0000
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {bioAvailable && hasSavedLogin ? (
          <>
            <Pressable
              onPress={handleBiometricLogin}
              disabled={loading}
              style={({ pressed }) => [styles.bioBtn, pressed && { opacity: 0.8 }, loading && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`Sign in with ${bioLabel}`}
            >
              <Ionicons name={bioIcon} size={22} color={COLORS.green} />
              <Text style={styles.bioBtnText}>Sign in with {bioLabel}</Text>
            </Pressable>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or use your password</Text>
              <View style={styles.orLine} />
            </View>
          </>
        ) : null}

        <FormField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={handleLogin}
        />

        <View style={styles.optionsRow}>
          {bioAvailable ? (
            <Pressable
              onPress={() => setEnableBio((v) => !v)}
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: enableBio }}
            >
              <View style={[styles.checkbox, enableBio && styles.checkboxOn]}>
                {enableBio ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text style={styles.checkLabel}>Use {bioLabel} next time</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={styles.link} onPress={openReset} accessibilityRole="link">
            Forgot password?
          </Text>
        </View>

        <Button title="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 6 }} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate("Signup")}>
            Create one
          </Text>
        </View>
      </ScrollView>

      <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={closeReset}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeReset} />
          <View style={styles.sheet}>
            {resetSent ? (
              <>
                <Text style={styles.sheetTitle}>Check your email</Text>
                <Text style={styles.sheetText}>
                  If an account exists for {resetEmail.trim()}, we've sent a link to reset your password. The link
                  may take a few minutes to arrive, so check your spam folder too.
                </Text>
                <Button title="Back to sign in" onPress={closeReset} />
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Reset your password</Text>
                <Text style={styles.sheetText}>
                  Enter your email address and we'll send you a link to set a new password.
                </Text>
                {resetError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{resetError}</Text>
                  </View>
                ) : null}
                <FormField
                  label="Email Address"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  onSubmitEditing={handleSendReset}
                />
                <Button title="Send reset link" onPress={handleSendReset} loading={resetLoading} />
                <Text style={[styles.link, { textAlign: "center" }]} onPress={closeReset}>
                  Cancel
                </Text>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 22, gap: 14 },
  h1: { fontFamily: "DMSerifDisplay", fontSize: 28, color: COLORS.dark, lineHeight: 34, marginTop: 8 },
  sub: { fontSize: 13, color: COLORS.muted, lineHeight: 20, marginBottom: 6 },
  demoBox: { backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim, borderRadius: 12, padding: 12 },
  demoText: { fontSize: 12, color: COLORS.green, lineHeight: 18 },
  errorBox: { backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: "#f0c8c8", borderRadius: 10, padding: 11 },
  errorText: { fontSize: 13, color: COLORS.red },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  footerText: { fontSize: 13, color: COLORS.muted },
  link: { fontSize: 13, color: COLORS.green, fontWeight: "700" },

  bioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.green,
    backgroundColor: COLORS.greenPale,
  },
  bioBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.green },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.greenDim, opacity: 0.5 },
  orText: { fontSize: 12, color: COLORS.muted },

  optionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.greenDim,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  checkLabel: { fontSize: 13, color: COLORS.muted },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 32,
    gap: 14,
  },
  sheetTitle: { fontFamily: "DMSerifDisplay", fontSize: 22, color: COLORS.dark },
  sheetText: { fontSize: 13, color: COLORS.muted, lineHeight: 20 },
});
