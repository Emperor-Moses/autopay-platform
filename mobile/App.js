import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ToastProvider } from "./src/context/ToastContext";
import AuthNavigator from "./src/navigation/AuthNavigator";
import MainNavigator from "./src/navigation/MainNavigator";
import { COLORS } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function RootNavigator() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.dark }}>
        <ActivityIndicator color={COLORS.greenLt} size="large" />
      </View>
    );
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}

export default function App() {
  // NOTE: Drop a real DMSerifDisplay-Regular.ttf into ./assets/fonts and
  // uncomment the loader below to enable the serif display font used
  // throughout the design (headings, amounts, etc). Until then the app
  // falls back to the system font automatically — nothing breaks.
  //
  // const [fontsLoaded] = useFonts({
  //   DMSerifDisplay: require("./assets/fonts/DMSerifDisplay-Regular.ttf"),
  // });
  // if (!fontsLoaded) {
  //   return (
  //     <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.dark }}>
  //       <ActivityIndicator color={COLORS.greenLt} size="large" />
  //     </View>
  //   );
  // }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
