import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import PricingScreen from "../screens/PricingScreen";
import ScheduleScreen from "../screens/schedule/ScheduleScreen";
import ScheduleConfirmScreen from "../screens/schedule/ScheduleConfirmScreen";
import ScheduleSuccessScreen from "../screens/schedule/ScheduleSuccessScreen";
import ScheduleDetailScreen from "../screens/schedule/ScheduleDetailScreen";
import BeneficiariesScreen from "../screens/beneficiaries/BeneficiariesScreen";
import BankScreen from "../screens/bank/BankScreen";
import BulkScreen from "../screens/bulk/BulkScreen";
import AnalyticsScreen from "../screens/analytics/AnalyticsScreen";

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="ScheduleConfirm" component={ScheduleConfirmScreen} />
      <Stack.Screen name="ScheduleSuccess" component={ScheduleSuccessScreen} />
      <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Beneficiaries" component={BeneficiariesScreen} />
      <Stack.Screen name="Bank" component={BankScreen} />
      <Stack.Screen name="Bulk" component={BulkScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="Pricing" component={PricingScreen} />
    </Stack.Navigator>
  );
}
