import React from "react";
import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { COLORS } from "../theme";
import { AlertsAPI } from "../api/resources";

import DashboardScreen from "../screens/dashboard/DashboardScreen";
import HistoryScreen from "../screens/history/HistoryScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ icon, focused, showDot }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 19, transform: [{ translateY: focused ? -2 : 0 }] }}>{icon}</Text>
      {showDot && (
        <View style={{ position: "absolute", top: -2, right: -6, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.red }} />
      )}
    </View>
  );
}

export default function TabNavigator() {
  const unreadQ = useQuery({ queryKey: ["unreadCount"], queryFn: AlertsAPI.unreadCount, refetchInterval: 30000 });
  const unread = unreadQ.data?.count || 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.muted2,
        tabBarStyle: { borderTopColor: COLORS.border, backgroundColor: COLORS.surface, paddingTop: 6, height: 64 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} /> }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} showDot={unread > 0} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
