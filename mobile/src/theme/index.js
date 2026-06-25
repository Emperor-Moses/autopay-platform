export const COLORS = {
  green: "#1a6641",
  greenMid: "#2a9f5a",
  greenLt: "#2edc72",
  greenPale: "#f0f8f3",
  greenDim: "#d8eee2",
  dark: "#0c140c",
  dark2: "#0f1a0f",
  text: "#1a2a1a",
  muted: "#5a7a5a",
  muted2: "#9ab09a",
  border: "#dce8dc",
  surface: "#ffffff",
  bg: "#f5f8f5",
  gold: "#c9923a",
  goldPale: "#fdf3e3",
  red: "#c94444",
  redPale: "#fdeaea",
  blue: "#1a4fa8",
  bluePale: "#e8eef8",
  purple: "#60269e",
  purplePale: "#f3f0f8",
};

export const RADIUS = { sm: 10, md: 14, lg: 18, xl: 24, pill: 100 };

export const SPACING = (n) => n * 4;

export const FONTS = {
  serif: "DMSerifDisplay",
  sans: "System",
};

export const TYPE_META = {
  Rent:         { icon: "🏠", bg: COLORS.bluePale,   fg: COLORS.blue },
  Utilities:    { icon: "💡", bg: COLORS.goldPale,    fg: COLORS.gold },
  Staff:        { icon: "👤", bg: COLORS.greenPale,   fg: COLORS.green },
  Loan:         { icon: "💳", bg: COLORS.redPale,     fg: COLORS.red },
  School:       { icon: "📚", bg: COLORS.purplePale,  fg: COLORS.purple },
  Subscription: { icon: "📱", bg: COLORS.greenPale,   fg: COLORS.green },
  Other:        { icon: "📦", bg: "#f5f5f5",          fg: COLORS.muted },
};

export const FREQ_LABEL = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", yearly: "Yearly", once: "Once",
};

const BANK_PALETTE = ["#1a6641","#c94444","#1a4fa8","#741B1B","#60269E","#00A651","#003087","#003B5C","#D62B2B","#F26722"];
export function bankColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return BANK_PALETTE[Math.abs(h) % BANK_PALETTE.length];
}
export function bankInitials(name = "") {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
