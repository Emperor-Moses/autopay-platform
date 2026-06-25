import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS } from "../../theme";
import { fmtDateTime } from "../../utils/format";
import { AlertsAPI } from "../../api/resources";
import EmptyState from "../../components/EmptyState";

export default function AlertsScreen({ navigation }) {
  const queryClient = useQueryClient();
  const alertsQ = useQuery({ queryKey: ["alerts"], queryFn: () => AlertsAPI.list() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
  }

  const markReadMut = useMutation({ mutationFn: (id) => AlertsAPI.markRead(id), onSuccess: invalidate });
  const markAllMut = useMutation({ mutationFn: AlertsAPI.markAllRead, onSuccess: invalidate });
  const removeMut = useMutation({ mutationFn: (id) => AlertsAPI.remove(id), onSuccess: invalidate });

  const unread = (alertsQ.data || []).filter((a) => !a.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllMut.mutate()}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={alertsQ.data || []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={
          <EmptyState icon="🔔" title="No notifications" subtitle="Payment alerts and reminders will appear here." />
        }
        renderItem={({ item: a }) => (
          <TouchableOpacity
            style={[styles.alertCard, !a.isRead && styles.alertUnread, a.type === "warn" && styles.alertWarn, a.type === "danger" && styles.alertDanger]}
            onPress={() => !a.isRead && markReadMut.mutate(a.id)}
          >
            <Text style={styles.dot}>{a.type === "danger" ? "🔴" : a.type === "warn" ? "🟡" : "🔵"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertMessage}>{a.message}</Text>
              <Text style={styles.alertTime}>{fmtDateTime(a.createdAt)}</Text>
            </View>
            <TouchableOpacity onPress={() => removeMut.mutate(a.id)} style={{ padding: 4 }}>
              <Text style={{ color: COLORS.muted2, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: "DMSerifDisplay", fontSize: 19, color: COLORS.dark },
  markAllBtn: { backgroundColor: COLORS.greenPale, borderWidth: 1, borderColor: COLORS.greenDim, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
  markAllText: { fontSize: 12, fontWeight: "700", color: COLORS.green },
  alertCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13,
    padding: 13, flexDirection: "row", gap: 12, marginBottom: 9, alignItems: "flex-start",
  },
  alertUnread: { borderColor: COLORS.greenDim, backgroundColor: COLORS.greenPale },
  alertWarn: { borderColor: "#f0d8b0", backgroundColor: COLORS.goldPale },
  alertDanger: { borderColor: "#f0c8c8", backgroundColor: COLORS.redPale },
  dot: { fontSize: 16 },
  alertTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text, lineHeight: 18 },
  alertMessage: { fontSize: 12, color: COLORS.muted, marginTop: 3, lineHeight: 18 },
  alertTime: { fontSize: 10, color: COLORS.muted2, marginTop: 5 },
});
