import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Svg, { Rect, Circle, Line, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import { COLORS } from "../../theme";
import Button from "../../components/Button";

export default function SplashScreen({ navigation }) {
  return (
    <LinearGradient colors={["#0b1a0b", "#0c140c"]} style={styles.wrap}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Svg width={100} height={100} viewBox="0 0 120 120">
          <Defs>
            <SvgGrad id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#2edc72" />
              <Stop offset="100%" stopColor="#1a6641" />
            </SvgGrad>
          </Defs>
          <Rect width={120} height={120} rx={28} fill="url(#g)" />
          <Circle cx={60} cy={60} r={27} stroke="white" strokeWidth={4.5} fill="none" opacity={0.9} />
          <Line x1={46} y1={46} x2={46} y2={74} stroke="white" strokeWidth={5} strokeLinecap="round" opacity={0.93} />
          <Line x1={74} y1={46} x2={74} y2={74} stroke="white" strokeWidth={5} strokeLinecap="round" opacity={0.93} />
          <Line x1={46} y1={46} x2={74} y2={74} stroke="white" strokeWidth={5} strokeLinecap="round" opacity={0.93} />
          <Line x1={42} y1={58} x2={78} y2={58} stroke="white" strokeWidth={4.5} strokeLinecap="round" opacity={0.93} />
          <Line x1={42} y1={65} x2={78} y2={65} stroke="white" strokeWidth={4.5} strokeLinecap="round" opacity={0.93} />
        </Svg>

        <Text style={styles.brand}>
          Auto<Text style={styles.brandAccent}>Pay</Text>
        </Text>
        <Text style={styles.tag}>PLATFORM</Text>

        <View style={styles.betaPill}>
          <Text style={styles.betaText}>● PRIVATE BETA v0.1</Text>
        </View>

        <Text style={styles.tagline}>Never miss a payment.{"\n"}Set it once. Relax forever.</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Sign In" onPress={() => navigation.navigate("Login")} />
        <Button
          title="Create Account"
          variant="outline"
          onPress={() => navigation.navigate("Signup")}
          style={{ borderColor: "rgba(255,255,255,0.15)" }}
        />
      </View>

      <Text style={styles.footer}>autopay.ng · Powered by Paystack · NDPA Compliant</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: 60, paddingHorizontal: 28 },
  center: { alignItems: "center", gap: 16 },
  brand: { fontFamily: "DMSerifDisplay", fontSize: 34, color: "#eef5ee", marginTop: 12 },
  brandAccent: { color: COLORS.greenLt, fontStyle: "italic" },
  tag: { fontSize: 11, color: "#3a5a3a", letterSpacing: 3, marginTop: -8 },
  betaPill: {
    backgroundColor: "rgba(46,220,114,0.1)",
    borderWidth: 1,
    borderColor: "rgba(46,220,114,0.2)",
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  betaText: { fontSize: 11, fontWeight: "700", color: COLORS.greenLt, letterSpacing: 1 },
  tagline: { fontSize: 14, color: "#6a8a6a", textAlign: "center", lineHeight: 22 },
  actions: { width: "100%", gap: 11 },
  footer: { fontSize: 11, color: "#2a4a2a", letterSpacing: 1 },
});
