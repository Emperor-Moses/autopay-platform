import api from "./client";

export const PlansAPI = {
  /** GET /plans/status — returns current plan, limits, and usage */
  status: () =>
    api.get("/plans/status").then((r) => r.data),

  /**
   * POST /plans/upgrade — { plan: "personal" | "business" }
   * Returns either:
   *   { method: "card", success: true, plan, message }   ← charged stored card
   *   { method: "checkout", checkoutUrl, plan, message } ← open in browser
   *   { method: "card", pending: true, message }         ← processing
   */
  upgrade: (plan) =>
    api.post("/plans/upgrade", { plan }).then((r) => r.data),

  /** DELETE /plans/cancel */
  cancel: () =>
    api.delete("/plans/cancel").then((r) => r.data),
};
