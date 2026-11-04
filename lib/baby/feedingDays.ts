import type { FeedingEntry } from "@/lib/state/babyTypes";
import { SAME_SESSION_MIN } from "@/lib/baby/predictions";

/**
 * Llogaritjet e ekranit të ushqyerjes: ditët e historikut, totalet e ditës, intervali mes ushqyerjeve dhe ushqimet
 * e fundit. Funksione të pastra (me `now` të dhënë), si dayStats.ts.
 */

const MIN = 60_000;

/** Uji dhe ilaçi shënohen te lista, por s'numërohen si ushqyerje. */
export const isFeed = (e: Pick<FeedingEntry, "type">) => e.type !== "water" && e.type !== "medicine";
const isBottle = (e: Pick<FeedingEntry, "type">) => e.type === "bottle" || e.type === "formula";

const time = (e: Pick<FeedingEntry, "at">) => new Date(e.at).getTime();
const newestFirst = (a: FeedingEntry, b: FeedingEntry) => time(b) - time(a);

export type DayTotals = { feeds: number; ml: number; breastMin: number; solids: number };

export function totals(entries: FeedingEntry[]): DayTotals {
  const out: DayTotals = { feeds: 0, ml: 0, breastMin: 0, solids: 0 };
  for (const e of entries) {
    if (!isFeed(e)) continue;
    out.feeds++;
    if (isBottle(e) && e.amountMl) out.ml += e.amountMl;
    if (e.type === "breast" && e.durationMin) out.breastMin += e.durationMin;
    if (e.type === "solid") out.solids++;
  }
  return out;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type FeedDay = { start: Date; entries: FeedingEntry[]; totals: DayTotals };

/** Ditët e historikut, më e reja e para; brenda ditës, shënimi më i ri i pari. */
export function groupByDay(log: FeedingEntry[]): FeedDay[] {
  const days: { start: Date; entries: FeedingEntry[] }[] = [];
  for (const e of [...log].sort(newestFirst)) {
    const start = startOfDay(new Date(e.at));
    const last = days[days.length - 1];
    if (last && last.start.getTime() === start.getTime()) last.entries.push(e);
    else days.push({ start, entries: [e] });
  }
  return days.map((d) => ({ ...d, totals: totals(d.entries) }));
}

/** Shënimet e një dite (nga mesnata deri në mesnatën tjetër). */
export function entriesOfDay(log: FeedingEntry[], day: Date): FeedingEntry[] {
  const from = startOfDay(day).getTime();
  const to = from + 86_400_000;
  return log.filter((e) => time(e) >= from && time(e) < to);
}

/** Nisjet e seancave (rritëse): gji majtas + djathtas, ose biberon pas gjirit, brenda 20 min janë një seancë. */
function sessionStarts(entries: FeedingEntry[]): number[] {
  const times = entries.filter(isFeed).map(time).sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of times) {
    if (out.length && t - out[out.length - 1] < SAME_SESSION_MIN * MIN) continue;
    out.push(t);
  }
  return out;
}

/** Intervali mesatar (minuta) mes seancave; boshllëqet mbi 8 orë janë shënime që mungojnë, jo ritëm. */
export function averageIntervalMin(entries: FeedingEntry[]): number | null {
  const s = sessionStarts(entries);
  const gaps: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const gap = (s[i] - s[i - 1]) / MIN;
    if (gap <= 8 * 60) gaps.push(gap);
  }
  if (!gaps.length) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

/** Intervali i zakonshëm i 3 ditëve të fundit, për unazën e kartës kur parashikimi s'ka ende mjaft të dhëna. */
export function usualIntervalMin(log: FeedingEntry[], now: Date): number | null {
  const from = now.getTime() - 3 * 86_400_000;
  return averageIntervalMin(log.filter((e) => time(e) >= from && time(e) <= now.getTime()));
}

/** Minutat nga ushqyerja e mëparshme, për çdo ushqyerje (sipas id); s'jepet për boshllëqe mbi 12 orë. */
export function gapsById(log: FeedingEntry[]): Map<string, number> {
  const feeds = log.filter(isFeed).sort((a, b) => time(a) - time(b));
  const out = new Map<string, number>();
  for (let i = 1; i < feeds.length; i++) {
    const gap = Math.round((time(feeds[i]) - time(feeds[i - 1])) / MIN);
    if (gap > 0 && gap <= 12 * 60) out.set(feeds[i].id, gap);
  }
  return out;
}

/** Ushqyerjet sot deri tani kundrejt dje deri në të njëjtën orë; null kur dje s'ka asnjë shënim. */
export function feedsVsYesterday(log: FeedingEntry[], now: Date): number | null {
  const today = startOfDay(now);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const sameTime = new Date(yesterday.getTime() + (now.getTime() - today.getTime()));
  const between = (from: Date, to: Date) => log.filter((e) => isFeed(e) && time(e) >= from.getTime() && time(e) < to.getTime()).length;
  if (between(yesterday, today) === 0) return null;
  return between(today, new Date(now.getTime() + 1)) - between(yesterday, sameTime);
}

/** Ushqimet e ngurta të fundit (pa përsëritje, pa dallim shkronjash të mëdha), më i fundit i pari. */
export function recentFoods(log: FeedingEntry[], limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...log].sort(newestFirst)) {
    if (e.type !== "solid" || !e.foodCategory) continue;
    for (const raw of e.foodCategory.split(",")) {
      const food = raw.trim();
      const key = food.toLocaleLowerCase();
      if (!food || seen.has(key)) continue;
      seen.add(key);
      out.push(food);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Çipat e ushqimeve: të fundit, pastaj të zakonshmit, pa përsëritje. */
export function foodChoices(recent: string[], defaults: string[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of [...recent, ...defaults]) {
    const key = f.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(f.trim());
    if (out.length >= max) break;
  }
  return out;
}

/** Sasitë e shpejta të biberonit; e fundit e përdorur shtohet kur s'është mes tyre. */
export const QUICK_ML = [60, 90, 120, 150, 180];

export function quickAmounts(last: number | null): number[] {
  return last != null && last > 0 && !QUICK_ML.includes(last) ? [...QUICK_ML, last].sort((a, b) => a - b) : QUICK_ML;
}

export const MAX_ML = 400;

/** Hapi i butonave − / +: 10 ml (5 ml nën 30, për të porsalindurit). */
export function stepMl(ml: number, dir: 1 | -1): number {
  const step = ml < 30 || (dir === -1 && ml <= 30) ? 5 : 10;
  const next = dir === 1 ? Math.floor(ml / step) * step + step : Math.ceil(ml / step) * step - step;
  return Math.max(0, Math.min(MAX_ML, next));
}

const SQ_DAYS = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
const SQ_MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Emri i ditës te historiku: "Sot", "Dje", pastaj "E hënë, 2 nëntor". Emrat janë me dorë: shqipja e `Intl` mungon
 * në disa telefona Android.
 */
export function dayLabel(start: Date, now: Date, lang: "sq" | "en", words: { today: string; yesterday: string }): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(start).getTime()) / 86_400_000);
  if (diff === 0) return words.today;
  if (diff === 1) return words.yesterday;
  const sameYear = start.getFullYear() === now.getFullYear();
  const year = sameYear ? "" : ` ${start.getFullYear()}`;
  return lang === "en"
    ? `${EN_DAYS[start.getDay()]}, ${start.getDate()} ${EN_MONTHS[start.getMonth()]}${year}`
    : `${SQ_DAYS[start.getDay()]}, ${start.getDate()} ${SQ_MONTHS[start.getMonth()]}${year}`;
}
