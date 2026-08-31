import React, { useState }      from "react";
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import * as WebBrowser            from "expo-web-browser";
import { useMutation }            from "@tanstack/react-query";
import { COLORS }                 from "../../theme";
import { PlansAPI }               from "../../api/plans";
import { useToast }               from "../../context/ToastContext";

/**
 * Usage — import and render wherever a plan limit might be hit:
 *
 *   const [paywall, setPaywall] = useState(null);
 *
 *   // When the API returns a 403:
 *   setPaywall({
 *     title:        "You've hit the free limit",
 *     body:         "Free plan supports up to 2 active schedules. Upgrade for unlimited.",
 *     requiredPlan: "personal",
 *   });
 *
 *   <PaywallModal
 *     visible={!!paywall}
 *     title={paywall?.title}
 *     body={paywall?.body}
 *     requiredPlan={paywall?.requiredPlan}
 *     onClose={() => setPaywall(null)}
 *     onUpgraded={() => { setPaywall(null); refetch(); }}
 *     onViewPlans={() => { setPaywall(null); navigation.navigate("Pricing"); }}
 *   />
 */
export default function PaywallModal({
  visible,
  title        = "Upgrade to continue",
  body         = "This feature requires a paid plan.",
  requiredPlan = "personal",
  onClose,
  onUpgraded,
  onViewPlans,
}) {
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(false);

  const planLabel = requiredPlan === "business" ? "Business (₦8,000/mo)" : "Personal (₦1,500/mo)";
  const planEmoji = requiredPlan === "business" ? "🏢" : "⚡";

  const upgradeMut = useMutation({
    mutationFn: () => PlansAPI.upgrade(requiredPlan),
    onSuccess:  async (data) => {
      if (data.method === "card" && data.success) {
        showToast(`✅ Upgraded to ${requiredPlan}!`);
        setProcessing(false);
        onUpgraded?.();
      } else if (data.checkoutUrl) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.checkoutUrl,
          "https://autopay-platform.netlify.app/plan-upgraded",
        );
        setProcessing(false);
        if (result.type === "success") {
          showToast("Payment received — activating your plan…");
          setTimeout(() => onUpgraded?.(), 3500);
        } else {
          showToast("Payment cancelled", "error");
        }
      } else if (data.pending) {
        showToast("Processing — plan will activate shortly.");
        setProcessing(false);
        setTimeout(() => onUpgraded?.(), 5000);
      }
    },
    onError: (e) => {
      setProcessing(false);
      showToast(e?.response?.data?.message ?? "Upgrade failed. Please try again.", "error");
    },
  });

  function handleUpgrade() {
    setProcessing(true);
    upgradeMut.mutate();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Lock icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🔒</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {/* Plan pill */}
          <View style={styles.planPill}>
            <Text style={styles.planPillText}>{planEmoji} {planLabel}</Text>
          </View>

          {/* Upgrade button */}
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={handleUpgrade}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.upgradeBtnText}>Upgrade now →</Text>
            )}
          </TouchableOpacity>

          {/* View all plans */}
          <TouchableOpacity style={styles.viewPlansBtn} onPress={onViewPlans}>
            <Text style={styles.viewPlansBtnText}>View all plans</Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissBtnText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:         28,
    paddingBottom:   40,
    alignItems:      "center",
  },

  iconWrap: {
    width:          64,
    height:         64,
    borderRadius:   32,
    backgroundColor: COLORS.greenPale,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   16,
  },
  iconText: { fontSize: 28 },

  title: {
    fontSize:     20,
    fontWeight:   "700",
    color:        COLORS.text,
    textAlign:    "center",
    marginBottom: 8,
  },
  body: {
    fontSize:     14,
    color:        COLORS.muted2,
    textAlign:    "center",
    lineHeight:   20,
    marginBottom: 20,
  },

  planPill: {
    backgroundColor: COLORS.greenPale,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:   7,
    marginBottom:    20,
  },
  planPillText: {
    color:      COLORS.green,
    fontSize:   13,
    fontWeight: "700",
  },

  upgradeBtn: {
    backgroundColor: COLORS.green,
    borderRadius:    12,
    paddingVertical: 14,
    width:           "100%",
    alignItems:      "center",
    marginBottom:    10,
  },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  viewPlansBtn: {
    paddingVertical: 10,
    width:           "100%",
    alignItems:      "center",
  },
  viewPlansBtnText: { color: COLORS.green, fontSize: 13, fontWeight: "600" },

  dismissBtn: {
    paddingVertical: 8,
  },
  dismissBtnText: { color: COLORS.muted2, fontSize: 13 },
});
