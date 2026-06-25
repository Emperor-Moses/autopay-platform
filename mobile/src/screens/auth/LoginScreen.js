import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { COLORS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import FormField from "../../components/FormField";
import Button from "../../components/Button";
import ScreenHeader from "../../components/ScreenHeader";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("demo@autopay.ng");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
        <Button title="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 6 }} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate("Signup")}>
            Create one
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
  demoBox: { backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim, borderRadius: 12, padding: 12 },
  demoText: { fontSize: 12, color: COLORS.green, lineHeight: 18 },
  errorBox: { backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: "#f0c8c8", borderRadius: 10, padding: 11 },
  errorText: { fontSize: 13, color: COLORS.red },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  footerText: { fontSize: 13, color: COLORS.muted },
  link: { fontSize: 13, color: COLORS.green, fontWeight: "700" },
});
