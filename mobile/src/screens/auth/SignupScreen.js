import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { COLORS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import FormField from "../../components/FormField";
import Button from "../../components/Button";
import ScreenHeader from "../../components/ScreenHeader";

export default function SignupScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name || !email || !password) {
      setError("Fill in all required fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    const res = await register(name, email, password, phone);
    setLoading(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Create Account" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Join AutoPay{"\n"}Beta.</Text>
        <Text style={styles.sub}>3 months of Personal plan free. No credit card needed.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormField label="Full Name" placeholder="Amaka Okonkwo" value={name} onChangeText={setName} textContentType="name" />
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
          onSubmitEditing={handleSignup}
        />
        <Button title="Create Account" onPress={handleSignup} loading={loading} style={{ marginTop: 6 }} />

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
  h1: { fontFamily: "DMSerifDisplay", fontSize: 28, color: COLORS.dark, lineHeight: 34, marginTop: 8 },
  sub: { fontSize: 13, color: COLORS.muted, lineHeight: 20, marginBottom: 6 },
  errorBox: { backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: "#f0c8c8", borderRadius: 10, padding: 11 },
  errorText: { fontSize: 13, color: COLORS.red },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  footerText: { fontSize: 13, color: COLORS.muted },
  link: { fontSize: 13, color: COLORS.green, fontWeight: "700" },
});
