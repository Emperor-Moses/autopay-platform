import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { COLORS, TYPE_META } from "../../theme";
import { NGN, fmtDateTime, cap } from "../../utils/format";
import { PaymentsAPI } from "../../api/resources";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import Badge from "../../components/Badge";

const FILTERS = ["all", "success", "failed", "scheduled", "cancelled", "pending"];
const PAGE_SIZE = 20;

const STATUS_TONE = {
  success: "neutral",
  failed: "danger",
  scheduled: "info",
  cancelled: "muted",
  processing: "warn",
  pending: "warn",
};

export default function HistoryScreen({ navigation }) {
  const [filter, setFilter] = useState("all");

  const query = useInfiniteQuery({
    queryKey: ["transactions", filter],
    queryFn: ({ pageParam = 0 }) =>
      PaymentsAPI.list({
        limit: PAGE_SIZE,
        offset: pageParam,
        ...(filter !== "all" ? { status: filter } : {}),
      }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.length * PAGE_SIZE;
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const items = (query.data?.pages || []).flatMap((p) => p.data);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenHeader title="Transaction History" onBack={() => navigation.goBack()} />
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{cap(f)}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        onEndReached={() => query.hasNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          !query.isLoading && (
            <EmptyState icon="📋" title="No transactions" subtitle="Your payment history will appear here." />
          )
        }
        renderItem={({ item: t }) => {
          const meta = TYPE_META[t.type] || TYPE_META.Other;
          return (
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.recipient} numberOfLines={1}>
                  {t.beneficiary?.name || "—"}
                </Text>
                <Text style={styles.date}>{fmtDateTime(t.initiatedAt)}</Text>
                <Text style={styles.ref}>{t.internalRef}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.amount,
                    t.status === "success" && { color: COLORS.green },
                    t.status === "failed" && { color: COLORS.red },
                  ]}
                >
                  {NGN(t.amount)}
                </Text>
                <Badge label={cap(t.status)} tone={STATUS_TONE[t.status] || "muted"} style={{ marginTop: 3 }} />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { paddingVertical: 10 },
  filterChip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 100, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  filterText: { fontSize: 12, fontWeight: "600", color: COLORS.muted },
  filterTextActive: { color: "#fff" },
  row: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13,
    padding: 13, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  recipient: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  date: { fontSize: 11, color: COLORS.muted2, marginTop: 2 },
  ref: { fontSize: 10, color: COLORS.muted2, marginTop: 1, fontFamily: "monospace" },
  amount: { fontSize: 14, fontWeight: "700", color: COLORS.text },
});
