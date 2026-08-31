export type PlanName = "free" | "personal" | "business";

export interface PlanLimits {
  maxSchedules:      number;   // Infinity = unlimited
  maxLinkedAccounts: number;
  historyDays:       number;
  bulkPayments:      boolean;
  pdfReports:        boolean;
  excelExports:      boolean;
  emailAlerts:       boolean;
  smsAlerts:         boolean;
  teamAccess:        boolean;
  maxTeamMembers:    number;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    maxSchedules:      2,
    maxLinkedAccounts: 1,
    historyDays:       30,
    bulkPayments:      false,
    pdfReports:        false,
    excelExports:      false,
    emailAlerts:       false,
    smsAlerts:         false,
    teamAccess:        false,
    maxTeamMembers:    0,
  },
  personal: {
    maxSchedules:      Infinity,
    maxLinkedAccounts: 3,
    historyDays:       Infinity,
    bulkPayments:      false,
    pdfReports:        true,
    excelExports:      false,
    emailAlerts:       true,
    smsAlerts:         true,
    teamAccess:        false,
    maxTeamMembers:    0,
  },
  business: {
    maxSchedules:      Infinity,
    maxLinkedAccounts: Infinity,
    historyDays:       Infinity,
    bulkPayments:      true,
    pdfReports:        true,
    excelExports:      true,
    emailAlerts:       true,
    smsAlerts:         true,
    teamAccess:        true,
    maxTeamMembers:    5,
  },
};

export const PLAN_PRICING = {
  personal: {
    naira: 1_500,
    kobo:  150_000,
    label: "Personal",
    description: "AutoPay Personal — Unlimited schedules, 3 linked cards",
  },
  business: {
    naira: 8_000,
    kobo:  800_000,
    label: "Business",
    description: "AutoPay Business — Bulk payroll, team access, Excel exports",
  },
};

// Friendly paywall messages shown in the mobile app
export const PAYWALL_MESSAGES: Record<string, { title: string; body: string; requiredPlan: PlanName }> = {
  maxSchedules: {
    title:        "You've hit the free limit",
    body:         "Free plan supports up to 2 active schedules. Upgrade to Personal for unlimited payment schedules.",
    requiredPlan: "personal",
  },
  maxLinkedAccounts: {
    title:        "Card limit reached",
    body:         "Free plan supports 1 linked card. Personal allows 3, Business allows unlimited.",
    requiredPlan: "personal",
  },
  bulkPayments: {
    title:        "Business feature",
    body:         "Bulk salary disbursement (CSV upload + payslips) is available on the Business plan.",
    requiredPlan: "business",
  },
  pdfReports: {
    title:        "Personal feature",
    body:         "PDF reports and exports are available on Personal and Business plans.",
    requiredPlan: "personal",
  },
  excelExports: {
    title:        "Business feature",
    body:         "Excel export is available on the Business plan.",
    requiredPlan: "business",
  },
};

export function getPlanLimits(plan?: string | null): PlanLimits {
  return PLAN_LIMITS[(plan as PlanName)] ?? PLAN_LIMITS.free;
}

export function isExpired(planExpiresAt?: Date | null): boolean {
  if (!planExpiresAt) return false;
  return new Date(planExpiresAt) < new Date();
}

export function effectivePlan(plan?: string | null, planExpiresAt?: Date | null): PlanName {
  if (!plan || plan === "free") return "free";
  if (isExpired(planExpiresAt)) return "free";
  return plan as PlanName;
}
