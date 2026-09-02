import api from "./client";

export const UsersAPI = {
  me:             ()        => api.get("/users/me").then((r) => r.data),
  updateMe:       (payload) => api.patch("/users/me", payload).then((r) => r.data),
  updateSettings: (payload) => api.patch("/users/me/settings", payload).then((r) => r.data),
  changePassword: (payload) => api.post("/users/me/change-password", payload).then((r) => r.data),
  deleteMe:       ()        => api.delete("/users/me").then((r) => r.data),

  // ── Linked cards ───────────────────────────────────────────────────────────
  bankAccounts: () =>
    api.get("/users/me/bank-accounts").then((r) => r.data),

  /**
   * Starts the ₦50 card linking flow.
   * Returns { checkoutUrl, reference, fee, message }.
   * Open checkoutUrl in WebBrowser — on success the webhook links the card.
   * No payload needed.
   */
  initiateLinkFee:   (callbackUrl) =>
    api.post("/users/me/bank-accounts/initiate-link", { callbackUrl }).then((r) => r.data),

  setDefaultAccount: (id) =>
    api.patch(`/users/me/bank-accounts/${id}/default`).then((r) => r.data),

  unlinkBankAccount: (id) =>
    api.delete(`/users/me/bank-accounts/${id}`).then((r) => r.data),
};
