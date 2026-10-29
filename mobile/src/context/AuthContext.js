import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { AuthAPI }      from "../api/auth";
import { UsersAPI }     from "../api/users";
import { TOKEN_KEY, REFRESH_KEY, apiErrorMessage } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [booting, setBooting] = useState(true);

  // ── Boot: check for stored token, fetch profile ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          const profile = await UsersAPI.me();
          setUser(profile);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_KEY);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    try {
      const data = await AuthAPI.login({ email, password, deviceInfo: "Expo App" });
      await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Incorrect email or password") };
    }
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (name, email, password, phone) => {
    try {
      const data = await AuthAPI.register({ name, email, password, phone });
      await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Could not create account") };
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      await AuthAPI.logout(refreshToken || undefined);
    } catch {
      // ignore — clear local state regardless
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      setUser(null);
    }
  }, []);

  // ── Refresh profile ───────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    try {
      const profile = await UsersAPI.me();
      setUser(profile);
    } catch {
      // ignore
    }
  }, []);

  // ── Request password reset (sends email) ──────────────────────────────────
  const requestPasswordReset = useCallback(async (email) => {
    try {
      await AuthAPI.forgotPassword(email);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Could not send reset link. Try again.") };
    }
  }, []);

  // ── Complete password reset (called from ResetPasswordScreen) ─────────────
  const resetPassword = useCallback(async (email, token, newPassword) => {
    try {
      await AuthAPI.resetPassword(email, token, newPassword);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Could not reset password. The link may have expired.") };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      booting,
      login,
      register,
      logout,
      refreshProfile,
      setUser,
      requestPasswordReset,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
