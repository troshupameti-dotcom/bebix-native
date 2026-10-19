import { clockTime } from "@/lib/dateUtils";

/**
 * Paneli i adminit në app: emrat dhe ngjyrat e statuseve, të njëjtat me panelin e webit (bebix-web/app/admin), që
 * admini të shohë të njëjtën gjë në të dy vendet. Paneli është mjet i brendshëm, prandaj tekstet janë vetëm shqip
 * (si në web).
 */
export type Tone = { fg: string; bg: string };
export type Option = { key: string; label: string; tone?: Tone };

export const TONES = {
  gray: { fg: "#6B6358", bg: "#ECE8E1" },
  green: { fg: "#2F7D3A", bg: "#DDF0DF" },
  orange: { fg: "#B8641A", bg: "#F7E4CF" },
  blue: { fg: "#2E6FA8", bg: "#D9E7F2" },
  red: { fg: "#C0392B", bg: "#F8DAD6" },
} satisfies Record<string, Tone>;

export const ORDER_STATUS: Option[] = [
  { key: "pending", label: "Në pritje", tone: TONES.gray },
  { key: "confirmed", label: "E konfirmuar", tone: TONES.green },
  { key: "shipped", label: "Dërguar", tone: TONES.orange },
  { key: "delivered", label: "Dorëzuar", tone: TONES.blue },
  { key: "cancelled", label: "Anuluar", tone: TONES.red },
];

export const PAYMENT_STATUS: Option[] = [
  { key: "unpaid", label: "Pa paguar", tone: TONES.gray },
  { key: "pending", label: "Pret pagesën", tone: TONES.orange },
  { key: "paid", label: "Paguar", tone: TONES.green },
  { key: "failed", label: "Dështoi", tone: TONES.red },
  { key: "refunded", label: "Rimbursuar", tone: TONES.blue },
];

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Në dorëzim",
  bank_transfer: "Transfertë bankare",
  card: "Kartë",
};

export const REVIEW_STATUS: Option[] = [
  { key: "pending", label: "Në pritje", tone: TONES.gray },
  { key: "approved", label: "Aprovuar", tone: TONES.green },
  { key: "rejected", label: "Refuzuar", tone: TONES.red },
];

export const PARTNER_STATUS: Option[] = [...REVIEW_STATUS, { key: "suspended", label: "Pezulluar", tone: TONES.orange }];

export const PAYOUT_STATUS: Option[] = [
  { key: "pending", label: "Në pritje", tone: TONES.gray },
  { key: "processing", label: "Në proces", tone: TONES.orange },
  { key: "paid", label: "Paguar", tone: TONES.green },
  { key: "failed", label: "Dështuar", tone: TONES.red },
];

export const REPORT_REASON: Record<string, string> = {
  spam: "Spam",
  harassment: "Ngacmim",
  inappropriate: "E papërshtatshme",
  misinformation: "Dezinformim",
  other: "Tjetër",
};

export const REPORT_STATUS: Record<string, string> = {
  open: "E hapur",
  reviewed: "E shqyrtuar",
  removed: "U hoq",
  dismissed: "E shpërfillur",
};

export const BADGES: Option[] = [
  { key: "", label: "Asnjë" },
  { key: "new", label: "E re" },
  { key: "sale", label: "Ofertë" },
  { key: "bestseller", label: "Më e shitur" },
];

export function optionOf(list: Option[], key: string | null | undefined): Option {
  return list.find((o) => o.key === key) ?? { key: key ?? "", label: key ?? "—", tone: TONES.gray };
}

export function eur(value: number): string {
  return `€${(Number(value) || 0).toFixed(2)}`;
}

/** Ndryshimi në përqindje kundrejt periudhës para ("+12%"), ose null kur s'ka bazë krahasimi. */
export function change(now: number, before: number): string | null {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function shortOrder(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${dateOnly(iso)} ${clockTime(d)}`;
}

/** Data lokale "YYYY-MM-DD" (për fushat e datave të pagesave). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- Periudhat e porosive (dita sipas orës së telefonit) ----

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "all";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Sot" },
  { key: "yesterday", label: "Dje" },
  { key: "week", label: "7 ditë" },
  { key: "month", label: "30 ditë" },
  { key: "all", label: "Të gjitha" },
];

export function periodRange(key: PeriodKey, now: Date = new Date()): { from: Date; to: Date } | null {
  if (key === "all") return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (offset: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
  if (key === "today") return { from: start, to: day(1) };
  if (key === "yesterday") return { from: day(-1), to: start };
  if (key === "week") return { from: day(-6), to: day(1) };
  return { from: day(-29), to: day(1) };
}

/** "Sot", "Dje" ose data, për ndarësit e porosive sipas ditës. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key(d) === key(now)) return "Sot";
  if (key(d) === key(yesterday)) return "Dje";
  return dateOnly(iso);
}

export function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
