import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL = Constants.expoConfig?.extra?.apiUrl || "http://localhost:3000/api/v1";

export const TOKEN_KEY = "autopay_access_token";
export const REFRESH_KEY = "autopay_refresh_token";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// ── Attach access token to every request ──────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh on 401 ─────────────────────────────────────────────────────
let isRefreshing = false;
let queue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && !config._retry) {
      config._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject, config });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
        await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);

        queue.forEach((p) => {
          p.config.headers.Authorization = `Bearer ${data.accessToken}`;
          p.resolve(api(p.config));
        });
        queue = [];

        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (err) {
        queue.forEach((p) => p.reject(err));
        queue = [];
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_KEY);
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err, fallback = "Something went wrong") {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
