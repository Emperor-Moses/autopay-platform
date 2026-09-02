import React, { useState }            from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useQuery, useMutation }       from "@tanstack/react-query";
import * as WebBrowser                 from "expo-web-browser";
import { COLORS }          from "../theme";
import { PlansAPI }        from "../api/plans";
import { apiErrorMessage } from "../api/client";
import { useToast }        from "../context/ToastContext";
import ScreenHeader                    from "../components/ScreenHeader";

const PLANS = [
  {
    id:          "free",
    label:       "Free",
    price:       "₦0",
    period:      "/ month",
    tagline:     "Try AutoPay with no commitment.",
    popular:     false,
    features: [
      { text: "Up to 2 active payment schedules",       included: true },
      { text: "1 linked bank account",                  included: true },
      { text: "Low-balance push notifications",         included: true },
      { text: "Payment history (30 days)",              included: true },
      { text: "Bulk / payroll payments",                included: false },
      { text: "PDF reporting & exports",                included: false },
      { text: "Email & SMS alerts",                     included: false },
    ],
  },
  {
    id:          "personal",
    label:       "Personal",
    price:       "₦1,500",
    period:      "/ month",
    tagline:     "Total payment peace of mind.",
    popular:     true,
    features: [
      { text: "Unlimited payment schedules",            included: true },
      { text: "Up to 3 linked bank accounts",          included: true },
      { text: "Low-balance alerts (Push + Email + SMS)",included: true },
      { text: "Full payment history",                   included: true },
      { text: "PDF reports & export",                   included: true },
      { text: "Bulk / payroll payments",                included: false },
      { text: "Team access",                            included: false },
    ],
  },
  {
    id:          "business",
    label:       "Business",
    price:       "₦8,000",
    period:      "/ month",
    tagline:     "For SMBs automating payroll.",
    popular:     false,
    features: [
      { text: "Everything in Personal",                 included: true },
      { text: "Unlimited bank accounts",                included: true },
      { text: "Bulk salary disbursement (CSV)",         included: true },
      { text: "Payslip receipt generation",             included: true },
      { text: "Team access (up to 5 users)",            included: true },
      { text: "Advanced reports + Excel export",        included: true },
      { text: "Priority support (2hr response)",        included: true },
    ],
  },
];

export default function PricingScreen({ navigation }) {
  const { showToast } = useToast();
  const [upgrading, setUpgrading] = useState(null);

  const planQ = useQuery({
    queryKey: ["planStatus"],
    queryFn:  PlansAPI.status,
  });

  const currentPlan = planQ.data?.plan ?? "free";

  const upgradeMut = useMutation({
    mutationFn: (plan) => PlansAPI.upgrade(plan),
    onSuccess:  async (data) => {
      if (data.method === "card" && data.success) {
        showToast(`✅ Upgraded to ${data.plan}!`);
        planQ.refetch();
      } else if (data.checkoutUrl) {
        // No stored card — open Paystack checkout
        const result = await WebBrowser.openAuthSessionAsync(
          data.checkoutUrl,
          "https://autopay-platform.netlify.app/plan-upgraded",
        );
        if (result.type === "success") {
          showToast("Payment received — activating your plan…");
          setTimeout(() => planQ.refetch(), 3000);
        } else {
          showToast("Payment cancelled", "error");
        }
      } else if (data.pending) {
        showToast("Payment is processing — plan will activate shortly.");
        setTimeout(() => planQ.refetch(), 5000);
      }
      setUpgrading(null);
    },
    onError: (e) => {
      showToast(apiErrorMessage(e, "Upgrade failed. Please try again."), "error");
      setUpgrading(null);
    },
  });

  const cancelMut = useMutation({
    mutationFn: PlansAPI.cancel,
    onSuccess:  (data) => {
      showToast(data.message);
      planQ.refetch();
    },
    onError: (e) => showToast(apiErrorMessage(e, "Could not cancel"), "error"),
  });

  function handleUpgrade(planId) {
    if (planId === "free" || planId === currentPlan) return;
    setUpgrading(planId);
    upgradeMut.mutate(planId);
  }

  function ctaLabel(planId) {
    if (planId === currentPlan) return "Current plan ✓";
    if (planId === "free")      return "Downgrade to Free";
    if (upgrading === planId)   return "Processing…";
    return `Upgrade to ${PLANS.find(p => p.id === planId)?.label}`;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="Plans & Pricing" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headline}>Simple, honest pricing.</Text>
        <Text style={styles.sub}>
          Start free. Upgrade when you're ready. No hidden fees.
        </Text>

        {planQ.isLoading ? (
          <ActivityIndicator color={COLORS.green} style={{ marginTop: 32 }} />
        ) : (
          PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isPopular = plan.popular;

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  isCurrent && styles.planCardActive,
                  isPopular && !isCurrent && styles.planCardPopular,
                ]}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Most Popular</Text>
                  </View>
                )}
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Your Plan</Text>
                  </View>
                )}

                <Text style={styles.planLabel}>{plan.label}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
                <Text style={styles.planTagline}>{plan.tagline}</Text>

                <View style={styles.featureList}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Text style={f.included ? styles.tick : styles.cross}>
                        {f.included ? "✓" : "✕"}
                      </Text>
                      <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>
                        {f.text}
                      </Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.ctaBtn,
                    isCurrent    && styles.ctaBtnCurrent,
                    plan.id === "free" && !isCurrent && styles.ctaBtnFree,
                  ]}
                  onPress={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || upgrading === plan.id}
                >
                  {upgrading === plan.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.ctaBtnText, isCurrent && styles.ctaBtnTextCurrent]}>
                      {ctaLabel(plan.id)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Cancel subscription */}
        {currentPlan !== "free" && (
          <TouchableOpacity
            onPress={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>
              {cancelMut.isPending ? "Cancelling…" : "Cancel subscription"}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>
          Payments are processed securely by Paystack. Your plan renews monthly.
          Cancel anytime — you keep access until the end of your billing period.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },

  headline: {
    fontSize:   22,
    fontWeight: "700",
    color:      COLORS.text,
    textAlign:  "center",
    marginTop:  8,
  },
  sub: {
    fontSize:     14,
    color:        COLORS.muted2,
    textAlign:    "center",
    marginTop:    6,
    marginBottom: 24,
    lineHeight:   20,
  },

  planCard: {
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    16,
    padding:         20,
    marginBottom:    16,
    position:        "relative",
  },
  planCardActive: {
    borderColor: COLORS.green,
    borderWidth: 2,
  },
  planCardPopular: {
    borderColor: COLORS.green,
  },

  popularBadge: {
    position:        "absolute",
    top:             -12,
    alignSelf:       "center",
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
    paddingVertical:  4,
    borderRadius:    20,
  },
  popularBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  currentBadge: {
    position:        "absolute",
    top:             12,
    right:           12,
    backgroundColor: COLORS.greenPale,
    paddingHorizontal: 8,
    paddingVertical:  3,
    borderRadius:    8,
  },
  currentBadgeText: { color: COLORS.green, fontSize: 10, fontWeight: "700" },

  planLabel:  { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  priceRow:   { flexDirection: "row", alignItems: "flex-end", gap: 4, marginBottom: 6 },
  planPrice:  { fontSize: 28, fontWeight: "800", color: COLORS.text },
  planPeriod: { fontSize: 13, color: COLORS.muted2, marginBottom: 4 },
  planTagline:{ fontSize: 12, color: COLORS.muted2, marginBottom: 16 },

  featureList: { gap: 8, marginBottom: 20 },
  featureRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tick:        { fontSize: 13, color: COLORS.green, fontWeight: "700", marginTop: 1 },
  cross:       { fontSize: 13, color: COLORS.muted2, fontWeight: "700", marginTop: 1 },
  featureText: { fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 18 },
  featureTextDim: { color: COLORS.muted2 },

  ctaBtn: {
    backgroundColor: COLORS.green,
    borderRadius:    10,
    paddingVertical: 13,
    alignItems:      "center",
  },
  ctaBtnCurrent: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  ctaBtnFree:    { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  ctaBtnText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  ctaBtnTextCurrent: { color: COLORS.muted2 },

  cancelBtn: {
    alignItems:     "center",
    padding:        12,
    marginBottom:   8,
  },
  cancelBtnText: { color: "#e53e3e", fontSize: 13 },

  footer: {
    fontSize:   11,
    color:      COLORS.muted2,
    textAlign:  "center",
    lineHeight: 16,
    marginTop:  8,
  },
});
