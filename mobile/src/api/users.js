import api from "./client";

export const UsersAPI = {
  me: () => api.get("/users/me").then((r) => r.data),
  updateMe: (payload) => api.patch("/users/me", payload).then((r) => r.data),
  updateSettings: (payload) => api.patch("/users/me/settings", payload).then((r) => r.data),
  changePassword: (payload) => api.patch("/users/me/password", payload).then((r) => r.data),
  deleteMe: () => api.delete("/users/me").then((r) => r.data),

  bankAccounts: () => api.get("/users/me/bank-accounts").then((r) => r.data),
  linkBank: (payload) => api.post("/users/me/bank-accounts", payload).then((r) => r.data),
  setDefaultBank: (id) => api.patch(`/users/me/bank-accounts/${id}/default`).then((r) => r.data),
  unlinkBank: (id) => api.delete(`/users/me/bank-accounts/${id}`).then((r) => r.data),
};
