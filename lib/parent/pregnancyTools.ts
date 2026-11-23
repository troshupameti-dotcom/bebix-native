import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Mjetet e shtatzënisë: numëruesi i lëvizjeve, kronometri i kontraksioneve dhe çanta e maternitetit.
 * Gjithçka rri vetëm në telefon (pa server, pa SQL): janë shënime të çastit, jo histori që ndahet me familjen.
 * Çelësat nisin me "bebix_", ndaj fshihen bashkë me llogarinë (lib/account/deleteAccount.ts) dhe kur në telefon
 * hyn një llogari tjetër (`clearPregnancyTools`).
 */

export const KICKS_KEY = "bebix_preg_kicks_v1";
export const CONTRACTIONS_KEY = "bebix_preg_contractions_v1";
export const BAG_KEY = "bebix_preg_bag_v1";

const MIN = 60_000;

// ---------- Lëvizjet ----------

/** Synimi i zakonshëm: 10 lëvizje. Kur arrihen, seanca mbyllet vetë. */
export const KICK_GOAL = 10;
/** Pas 2 orësh pa arritur 10, seanca mbyllet dhe prindi këshillohet të telefonojë. */
export const KICK_WINDOW_MIN = 120;

export type KickSession = {
  startedAt: string;
  /** Çastet e çdo lëvizjeje, me radhë. */
  kicks: string[];
  /** Mungon gjatë numërimit. */
  endedAt?: string;
};

export type KickState = { current: KickSession | null; history: KickSession[] };

const EMPTY_KICKS: KickState = { current: null, history: [] };
const MAX_HISTORY = 30;

/** Lëvizja e radhës; e para nis seancën. Me lëvizjen e 10-të seanca mbyllet dhe kalon te historiku. */
export function addKick(state: KickState, now: Date = new Date()): KickState {
  const at = now.toISOString();
  const current = state.current ?? { startedAt: at, kicks: [] };
  const next = { ...current, kicks: [...current.kicks, at] };
  if (next.kicks.length >= KICK_GOAL) return finishKicks({ ...state, current: next }, now);
  return { ...state, current: next };
}

/** Heq lëvizjen e fundit (kur u shtyp gabimisht). Pa lëvizje, seanca anulohet. */
export function undoKick(state: KickState): KickState {
  if (!state.current) return state;
  const kicks = state.current.kicks.slice(0, -1);
  return { ...state, current: kicks.length ? { ...state.current, kicks } : null };
}

/** Mbyll seancën që po ecën (edhe pa 10 lëvizje) dhe e vendos te historiku. */
export function finishKicks(state: KickState, now: Date = new Date()): KickState {
  if (!state.current || state.current.kicks.length === 0) return { ...state, current: null };
  const done: KickSession = { ...state.current, endedAt: now.toISOString() };
  return { current: null, history: [done, ...state.history].slice(0, MAX_HISTORY) };
}

/** Minutat nga nisja e seancës deri te lëvizja e fundit (ose deri tani, kur s'ka mbaruar). */
export function kickMinutes(session: KickSession, now: Date = new Date()): number {
  const end = session.endedAt ? new Date(session.kicks[session.kicks.length - 1] ?? session.endedAt) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(session.startedAt).getTime()) / MIN));
}

/** A ka kaluar dritarja prej 2 orësh pa u arritur synimi. */
export function kickWindowOver(session: KickSession, now: Date = new Date()): boolean {
  return session.kicks.length < KICK_GOAL && now.getTime() - new Date(session.startedAt).getTime() >= KICK_WINDOW_MIN * MIN;
}

export function reachedGoal(session: KickSession): boolean {
  return session.kicks.length >= KICK_GOAL;
}

// ---------- Kontraksionet ----------

export type Contraction = { startAt: string; endAt: string | null };

/** Nis një kontraksion; nëse një tjetër po ecën, e mbyll atë më parë. */
export function startContraction(list: Contraction[], now: Date = new Date()): Contraction[] {
  const closed = stopContraction(list, now);
  return [{ startAt: now.toISOString(), endAt: null }, ...closed].slice(0, 200);
}

export function stopContraction(list: Contraction[], now: Date = new Date()): Contraction[] {
  const [first, ...rest] = list;
  if (!first || first.endAt) return list;
  return [{ ...first, endAt: now.toISOString() }, ...rest];
}

export function activeContraction(list: Contraction[]): Contraction | null {
  return list[0] && !list[0].endAt ? list[0] : null;
}

/** Sekondat e kontraksionit (deri tani, kur po ecën). */
export function durationSec(c: Contraction, now: Date = new Date()): number {
  const end = c.endAt ? new Date(c.endAt).getTime() : now.getTime();
  return Math.max(0, Math.round((end - new Date(c.startAt).getTime()) / 1000));
}

/** Sekondat nga nisja e kontraksionit të mëparshëm deri te nisja e këtij (lista: më i riu i pari). */
export function intervalSec(list: Contraction[], index: number): number | null {
  const prev = list[index + 1];
  if (!prev) return null;
  return Math.max(0, Math.round((new Date(list[index].startAt).getTime() - new Date(prev.startAt).getTime()) / 1000));
}

export type ContractionSummary = {
  /** Kontraksione të mbaruara në orën e fundit. */
  count: number;
  avgDurationSec: number | null;
  avgIntervalSec: number | null;
  /** "511": çdo ≤ 5 min, rreth 1 min secili, prej një ore. "regular": të rregullta, por jo ende 5-1-1. */
  status: "none" | "early" | "regular" | "511";
};

/**
 * Rregulli 5-1-1 (i zakonshëm për lindjen e parë): kontraksione çdo 5 minuta ose më shpesh, që zgjasin rreth
 * 1 minutë, prej të paktën 1 ore. Lejohet pak tolerancë, sepse prindi s'shtyp në sekondë të saktë.
 */
export function summarizeContractions(list: Contraction[], now: Date = new Date()): ContractionSummary {
  const from = now.getTime() - 60 * MIN;
  const recent = list.filter((c) => c.endAt && new Date(c.startAt).getTime() >= from);
  if (recent.length === 0) return { count: 0, avgDurationSec: null, avgIntervalSec: null, status: "none" };
  const avgDurationSec = Math.round(recent.reduce((s, c) => s + durationSec(c), 0) / recent.length);
  if (recent.length < 2) return { count: recent.length, avgDurationSec, avgIntervalSec: null, status: "early" };
  // Intervalet brenda orës: nga më i vjetri te më i riu.
  const starts = recent.map((c) => new Date(c.startAt).getTime()).sort((a, b) => a - b);
  const gaps = starts.slice(1).map((s, i) => (s - starts[i]) / 1000);
  const avgIntervalSec = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  const spanMin = (now.getTime() - starts[0]) / MIN;
  const frequent = avgIntervalSec <= 5.5 * 60;
  const long = avgDurationSec >= 50;
  let status: ContractionSummary["status"] = "early";
  if (frequent && long && spanMin >= 50) status = "511";
  else if (recent.length >= 4 && avgIntervalSec <= 10 * 60) status = "regular";
  return { count: recent.length, avgDurationSec, avgIntervalSec, status };
}

/** "1:05" ose "45 s". */
export function formatSec(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------- Çanta e maternitetit ----------

export type BagGroup = "docs" | "mom" | "baby";
export type BagItem = { id: string; group: BagGroup };

/** Renditja e listës; tekstet janë te përkthimet (`bag_item_<id>`). */
export const BAG_ITEMS: BagItem[] = [
  { id: "id_card", group: "docs" },
  { id: "pregnancy_file", group: "docs" },
  { id: "phone_numbers", group: "docs" },
  { id: "nightgown", group: "mom" },
  { id: "robe_slippers", group: "mom" },
  { id: "maternity_pads", group: "mom" },
  { id: "underwear", group: "mom" },
  { id: "nursing_bra", group: "mom" },
  { id: "nipple_cream", group: "mom" },
  { id: "toiletries", group: "mom" },
  { id: "charger", group: "mom" },
  { id: "snacks", group: "mom" },
  { id: "going_home_mom", group: "mom" },
  { id: "bodysuits", group: "baby" },
  { id: "hat_socks", group: "baby" },
  { id: "newborn_diapers", group: "baby" },
  { id: "wipes", group: "baby" },
  { id: "swaddle", group: "baby" },
  { id: "going_home_baby", group: "baby" },
  { id: "car_seat", group: "baby" },
];

export function bagProgress(checked: string[]): { done: number; total: number } {
  const ids = new Set(BAG_ITEMS.map((i) => i.id));
  return { done: new Set(checked.filter((c) => ids.has(c))).size, total: BAG_ITEMS.length };
}

export function toggleBagItem(checked: string[], id: string): string[] {
  return checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id];
}

// ---------- Ruajtja ----------

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Pa hapësirë ose pa leje: ekrani vazhdon me gjendjen në memorie.
  }
}

export async function loadKicks(): Promise<KickState> {
  const s = await readJson<KickState>(KICKS_KEY, EMPTY_KICKS);
  return { current: s.current ?? null, history: Array.isArray(s.history) ? s.history : [] };
}
export const saveKicks = (s: KickState) => writeJson(KICKS_KEY, s);

export async function loadContractions(): Promise<Contraction[]> {
  const l = await readJson<Contraction[]>(CONTRACTIONS_KEY, []);
  return Array.isArray(l) ? l : [];
}
export const saveContractions = (l: Contraction[]) => writeJson(CONTRACTIONS_KEY, l);

export async function loadBag(): Promise<string[]> {
  const l = await readJson<string[]>(BAG_KEY, []);
  return Array.isArray(l) ? l : [];
}
export const saveBag = (l: string[]) => writeJson(BAG_KEY, l);

/** Kur në telefon hyn një llogari tjetër: shënimet e shtatzënisë s'i kalojnë asaj. */
export async function clearPregnancyTools(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KICKS_KEY, CONTRACTIONS_KEY, BAG_KEY]);
  } catch {
    // s'ka gjë për të bërë
  }
}
