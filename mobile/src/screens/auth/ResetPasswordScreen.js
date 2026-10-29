import React, { useState }  from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { COLORS }           from "../../theme";
import { useAuth }          from "../../context/AuthContext";
import FormField            from "../../components/FormField";
import Button               from "../../components/Button";
import ScreenHeader         from "../../components/ScreenHeader";

/**
 * ResetPasswordScreen
 *
 * Reached via deep link: autopay://reset-password?token=xxx&email=yyy
 * Add this to your navigator:
 *   <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
 *
 * And in your app.json linking config:
 *   "screens": { "ResetPassword": "reset-password" }
 */
export default function ResetPasswordScreen({ navigation, route }) {
  const { resetPassword } = useAuth();

  const token = route?.params?.token ?? "";
  const email = route?.params?.email ?? "";

  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);

  async function handleReset() {
    setError("");

    if (!password || !confirmPassword) {
      setError("Fill in both fields");
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
    if (!token || !email) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    const res = await resetPassword(email, token, password);
    setLoading(false);

    if (res.ok) {
      setDone(true);
    } else {
      setError(res.error);
    }
  }

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Password reset!</Text>
        <Text style={styles.doneSub}>
          Your password has been updated. You can now sign in with your new password.
        </Text>
        <Button
          title="Go to Sign In"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="New Password" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Set a new{"\n"}password.</Text>
        <Text style={styles.sub}>
          Choose a strong password — at least 8 characters.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormField
          label="New Password"
          placeholder="Min. 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          hint="At least 8 characters"
        />
        <FormField
          label="Confirm New Password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          onSubmitEditing={handleReset}
        />

        <Button
          title="Reset Password"
          onPress={handleReset}
          loading={loading}
          disabled={loading}
          style={{ marginTop: 6 }}
        />
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
    fontSize:    13,
    color:       COLORS.muted,
    lineHeight:  20,
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

  // ── Done state ─────────────────────────────────────────────────────────────
  doneContainer: {
    flex:            1,
    backgroundColor: COLORS.bg,
    alignItems:      "center",
    justifyContent:  "center",
    padding:         32,
  },
  doneIcon:  { fontSize: 56, marginBottom: 20 },
  doneTitle: {
    fontFamily:  "DMSerifDisplay",
    fontSize:    26,
    color:       COLORS.dark,
    marginBottom: 12,
    textAlign:   "center",
  },
  doneSub: {
    fontSize:   14,
    color:      COLORS.muted,
    lineHeight: 22,
    textAlign:  "center",
  },
});
