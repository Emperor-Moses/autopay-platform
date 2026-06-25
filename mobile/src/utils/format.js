import dayjs from "dayjs";

export const NGN = (n) => `₦${Number(n ?? 0).toLocaleString("en-NG")}`;

export const fmtDate = (d) => (d ? dayjs(d).format("D MMM YYYY") : "—");

export const fmtDateTime = (d) => (d ? dayjs(d).format("D MMM · h:mm A") : "—");

export const daysUntil = (d) => {
  if (!d) return null;
  return Math.max(0, dayjs(d).startOf("day").diff(dayjs().startOf("day"), "day"));
};

export const urgencyLabel = (d) => {
  const n = daysUntil(d);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `${n} days`;
};

export const urgencyTone = (d) => {
  const n = daysUntil(d);
  if (n <= 1) return "danger";
  if (n <= 3) return "warn";
  return "info";
};

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
};

export const last4 = (s) => (s ? s.slice(-4) : "0000");
