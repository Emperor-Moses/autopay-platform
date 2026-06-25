import api from "./client";

export const AuthAPI = {
  register: (payload) => api.post("/auth/register", payload).then((r) => r.data),
  login: (payload) => api.post("/auth/login", payload).then((r) => r.data),
  refresh: (refreshToken) => api.post("/auth/refresh", { refreshToken }).then((r) => r.data),
  logout: (refreshToken) => api.post("/auth/logout", { refreshToken }).then((r) => r.data),
  setPin: (payload) => api.post("/auth/pin", payload).then((r) => r.data),
  verifyPin: (pin) => api.post("/auth/pin/verify", { pin }).then((r) => r.data),
};
