import api from "./client";

export const BeneficiariesAPI = {
  list: () => api.get("/beneficiaries").then((r) => r.data),
  get: (id) => api.get(`/beneficiaries/${id}`).then((r) => r.data),
  create: (payload) => api.post("/beneficiaries", payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/beneficiaries/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/beneficiaries/${id}`).then((r) => r.data),
};

export const SchedulesAPI = {
  list: (status) => api.get("/schedules", { params: status ? { status } : {} }).then((r) => r.data),
  summary: () => api.get("/schedules/summary").then((r) => r.data),
  get: (id) => api.get(`/schedules/${id}`).then((r) => r.data),
  create: (payload) => api.post("/schedules", payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/schedules/${id}`, payload).then((r) => r.data),
  pause: (id, payload = {}) => api.patch(`/schedules/${id}/pause`, payload).then((r) => r.data),
  resume: (id) => api.patch(`/schedules/${id}/resume`).then((r) => r.data),
  cancel: (id, payload = {}) => api.delete(`/schedules/${id}`, { data: payload }).then((r) => r.data),
};

export const PaymentsAPI = {
  list: (params = {}) => api.get("/transactions", { params }).then((r) => r.data),
  get: (id) => api.get(`/transactions/${id}`).then((r) => r.data),
  bulk: (payload) => api.post("/transactions/bulk", payload).then((r) => r.data),
};

export const AlertsAPI = {
  list: (unreadOnly) => api.get("/alerts", { params: unreadOnly ? { unread: "true" } : {} }).then((r) => r.data),
  unreadCount: () => api.get("/alerts/unread-count").then((r) => r.data),
  markRead: (id) => api.patch(`/alerts/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch("/alerts/read-all").then((r) => r.data),
  remove: (id) => api.delete(`/alerts/${id}`).then((r) => r.data),
};

// Paystack public bank list (used for picking/searching banks during linking)
export const fetchBanks = () =>
  fetch("https://api.paystack.co/bank?country=nigeria&perPage=100")
    .then((r) => r.json())
    .then((j) => (j.status ? j.data.filter((b) => b.active && !b.is_deleted) : []));
