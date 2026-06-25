import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View style={styles.wrap} pointerEvents="none">
          <View style={[styles.toast, toast.type === "error" && styles.error]}>
            <Text style={styles.icon}>{toast.type === "error" ? "✕" : "✓"}</Text>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 96,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  toast: {
    backgroundColor: COLORS.dark,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  error: { backgroundColor: COLORS.red },
  icon: { color: "#fff", fontSize: 13, fontWeight: "700" },
  text: { color: "#fff", fontSize: 13, fontWeight: "500" },
});
