import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { COLORS, RADIUS } from "../../theme";
import { NGN, greeting } from "../../utils/format";
import { SchedulesAPI } from "../../api/resources";
import { AlertsAPI } from "../../api/resources";
import { UsersAPI } from "../../api/users";
import { useAuth } from "../../context/AuthContext";
import ScheduleCard from "../../components/ScheduleCard";
import EmptyState from "../../components/EmptyState";

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("scheduled");

  const summaryQ = useQuery({ queryKey: ["summary"], queryFn: SchedulesAPI.summary });
  const schedulesQ = useQuery({ queryKey: ["schedules"], queryFn: () => SchedulesAPI.list() });
  const bankQ = useQuery({ queryKey: ["bankAccounts"], queryFn: UsersAPI.bankAccounts });
  const unreadQ = useQuery({ queryKey: ["unreadCount"], queryFn: AlertsAPI.unreadCount });

  useFocusEffect(
    useCallback(() => {
      summaryQ.refetch();
      schedulesQ.refetch();
      bankQ.refetch();
      unreadQ.refetch();
    }, [])
  );

  const defaultBank = bankQ.data?.find((b) => b.isDefault) || bankQ.data?.[0];
  const active = (schedulesQ.data || []).filter((s) => s.status === "active");
  const paused = (schedulesQ.data || []).filter((s) => s.status === "paused");
  const shown = tab === "scheduled" ? active : tab === "paused" ? paused : [];
  const scheduledTotal = summaryQ.data?.upcoming?.reduce((s, x) => s + Number(x.amount), 0) || 0;
  const unread = unreadQ.data?.count || 0;

  const onRefresh = () => {
    summaryQ.refetch();
    schedulesQ.refetch();
    bankQ.refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={summaryQ.isFetching} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <LinearGradient colors={["#0b1a0b", "#1a3822"]} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greetLabel}>{greeting()}</Text>
              <Text style={styles.greetName}>{user?.name || "User"}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Alerts")}>
                <Text style={{ fontSize: 15 }}>🔔</Text>
                {unread > 0 && <View style={styles.dot} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Analytics")}>
                <Text style={{ fontSize: 15 }}>📊</Text>
              </TouchableOpacity>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || "U")[0].toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {defaultBank ? (
            <View style={styles.balanceCard}>
              <View style={styles.balanceTopRow}>
                <Text style={styles.bankLabel}>
                  {defaultBank.bankName} ···{defaultBank.accountNumber?.slice(-4)}
                </Text>
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>DEFAULT</Text>
                </View>
              </View>
              <Text style={styles.balanceAmount}>{NGN(scheduledTotal > 0 ? 485000 : 485000)}</Text>
              <View style={{ flexDirection: "row", gap: 18 }}>
                <Text style={styles.miniStat}>
                  Scheduled <Text style={{ color: "#ff8080" }}>{NGN(scheduledTotal)}</Text>
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.linkBankCard} onPress={() => navigation.navigate("Bank")}>
              <Text style={{ fontSize: 22, marginBottom: 6 }}>🏦</Text>
              <Text style={styles.linkBankTitle}>Link Your Bank Account</Text>
              <Text style={styles.linkBankSub}>Connect to Paystack to enable scheduled payments</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          {[
            { label: "Active", val: active.length, color: COLORS.green },
            { label: "Paused", val: paused.length, color: COLORS.gold },
            { label: "Recipients", val: "—", color: COLORS.blue },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { id: "scheduled", label: "Scheduled" },
            { id: "paused", label: "Paused" },
            { id: "quick", label: "Quick Actions" },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 14 }}>
          {tab === "quick" && (
            <View style={styles.grid}>
              {[
                { icon: "➕", label: "New Schedule", sub: "Set up auto payment", onPress: () => navigation.navigate("Schedule") },
                { icon: "👥", label: "Bulk Pay", sub: "Pay multiple at once", onPress: () => navigation.navigate("Bulk") },
                { icon: "🏦", label: defaultBank ? "Change Bank" : "Link Bank", sub: "Manage bank accounts", onPress: () => navigation.navigate("Bank") },
                { icon: "👤", label: "Add Recipient", sub: "Save a beneficiary", onPress: () => navigation.navigate("Beneficiaries") },
                { icon: "📊", label: "Analytics", sub: "Spending insights", onPress: () => navigation.navigate("Analytics") },
                { icon: "📋", label: "History", sub: "All transactions", onPress: () => navigation.navigate("History") },
              ].map((q) => (
                <TouchableOpacity key={q.label} style={styles.quickAction} onPress={q.onPress}>
                  <Text style={{ fontSize: 22 }}>{q.icon}</Text>
                  <Text style={styles.quickLabel}>{q.label}</Text>
                  <Text style={styles.quickSub}>{q.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {tab !== "quick" && shown.length === 0 && (
            <EmptyState
              icon={tab === "paused" ? "⏸" : "📅"}
              title={tab === "paused" ? "No paused schedules" : "No active schedules"}
              subtitle={tab === "paused" ? "All your schedules are running smoothly." : "Set up your first automatic payment below."}
              actionLabel={tab === "scheduled" ? "+ New Schedule" : undefined}
              onAction={() => navigation.navigate("Schedule")}
            />
          )}

          {tab !== "quick" &&
            shown.map((sch) => (
              <ScheduleCard
                key={sch.id}
                schedule={sch}
                beneficiary={sch.beneficiary}
                onPress={() => navigation.navigate("ScheduleDetail", { id: sch.id })}
              />
            ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("Schedule")}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  greetLabel: { fontSize: 11, color: "#6a8a6a" },
  greetName: { fontSize: 16, fontWeight: "600", color: "#eef5ee", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 9, alignItems: "center" },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.11)", alignItems: "center", justifyContent: "center",
  },
  dot: { position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.red, borderWidth: 2, borderColor: "#0b1a0b" },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(46,220,114,0.14)",
    borderWidth: 2, borderColor: "rgba(46,220,114,0.3)", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: COLORS.greenLt },
  balanceCard: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 16 },
  balanceTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  bankLabel: { fontSize: 10, color: "#6a8a6a", textTransform: "uppercase", letterSpacing: 1, fontWeight: "600" },
  defaultPill: { backgroundColor: "rgba(46,220,114,0.15)", borderWidth: 1, borderColor: "rgba(46,220,114,0.2)", borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8 },
  defaultPillText: { fontSize: 9, color: COLORS.greenLt, fontWeight: "700" },
  balanceAmount: { fontFamily: "DMSerifDisplay", fontSize: 32, color: "#fff", marginVertical: 6 },
  miniStat: { fontSize: 11, fontWeight: "600", color: "rgba(240,128,128,0.6)" },
  linkBankCard: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1.5, borderColor: "rgba(46,220,114,0.3)", borderStyle: "dashed", borderRadius: 16, padding: 16, alignItems: "center" },
  linkBankTitle: { fontSize: 14, fontWeight: "600", color: COLORS.greenLt, marginBottom: 3 },
  linkBankSub: { fontSize: 12, color: "#6a8a6a", textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 9, alignItems: "center" },
  statVal: { fontSize: 15, fontWeight: "700" },
  statLabel: { fontSize: 10, color: COLORS.muted2, marginTop: 1, textTransform: "uppercase" },
  tabRow: { flexDirection: "row", gap: 4, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  tabText: { fontSize: 12, fontWeight: "600", color: COLORS.muted },
  tabTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 6 },
  quickAction: {
    width: "47%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 13, padding: 12, alignItems: "center", gap: 5,
  },
  quickLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  quickSub: { fontSize: 10, color: COLORS.muted2, textAlign: "center" },
  fab: {
    position: "absolute", right: 18, bottom: 24, width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { fontSize: 26, color: "#fff", fontWeight: "300", marginTop: -2 },
});
