import React, { useState }   from "react";
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from "react-native";
import { COLORS }             from "../../theme";
import { useAuth }            from "../../context/AuthContext";
import FormField              from "../../components/FormField";
import Button                 from "../../components/Button";
import ScreenHeader           from "../../components/ScreenHeader";

export default function SignupScreen({ navigation }) {
  const { register } = useAuth();

  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [phone,           setPhone]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed,          setAgreed]          = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  async function handleSignup() {
    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("Fill in all required fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!agreed) {
      setError("You must accept the Terms of Use to create an account");
      return;
    }

    setLoading(true);
    const res = await register(name, email, password, phone);
    setLoading(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Create Account" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Join AutoPay{"\n"}Beta.</Text>
        <Text style={styles.sub}>
          3 months of Personal plan free. No credit card needed.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormField
          label="Full Name"
          placeholder="Amaka Okonkwo"
          value={name}
          onChangeText={setName}
          textContentType="name"
        />
        <FormField
          label="Email Address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <FormField
          label="Phone (optional)"
          placeholder="+2348012345678"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <FormField
          label="Password"
          placeholder="Min. 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          hint="At least 8 characters"
        />
        <FormField
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          onSubmitEditing={handleSignup}
        />

        {/* ── Terms of Use checkbox ─────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            I have read and accept the{" "}
            <Text
              style={styles.link}
              onPress={() => navigation.navigate("Terms")}
            >
              Terms of Use
            </Text>
            {" "}and{" "}
            <Text
              style={styles.link}
              onPress={() => navigation.navigate("Privacy")}
            >
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        <Button
          title="Create Account"
          onPress={handleSignup}
          loading={loading}
          disabled={loading}
          style={{ marginTop: 6 }}
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
            Sign in
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 22, gap: 14 },

  h1: {
    fontFamily:  "DMSerifDisplay",
    fontSize:    28,
    color:       COLORS.dark,
    lineHeight:  34,
    marginTop:   8,
  },
  sub: {
    fontSize:   13,
    color:      COLORS.muted,
    lineHeight: 20,
    marginBottom: 6,
  },

  errorBox: {
    backgroundColor: COLORS.redPale,
    borderWidth:     1,
    borderColor:     "#f0c8c8",
    borderRadius:    10,
    padding:         11,
  },
  errorText: { fontSize: 13, color: COLORS.red },

  // ── Checkbox ──────────────────────────────────────────────────────────────
  checkRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           10,
    marginTop:     4,
  },
  checkbox: {
    width:        22,
    height:       22,
    borderRadius: 6,
    borderWidth:  2,
    borderColor:  COLORS.border,
    alignItems:   "center",
    justifyContent: "center",
    flexShrink:   0,
    marginTop:    1,
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: {
    backgroundColor: COLORS.green,
    borderColor:     COLORS.green,
  },
  checkmark: {
    color:      "#fff",
    fontSize:   13,
    fontWeight: "700",
    lineHeight: 16,
  },
  checkLabel: {
    flex:       1,
    fontSize:   13,
    color:      COLORS.muted,
    lineHeight: 20,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerRow: {
    flexDirection:  "row",
    justifyContent: "center",
    marginTop:      10,
  },
  footerText: { fontSize: 13, color: COLORS.muted },
  link: { fontSize: 13, color: COLORS.green, fontWeight: "700" },
});
