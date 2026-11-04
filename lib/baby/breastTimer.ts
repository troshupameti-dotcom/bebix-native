import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import type { BreastSide } from "@/lib/state/babyTypes";

/**
 * Timeri i gjidhënies (start/stop si te gjumi).
 *
 * Gjatë kohës që timeri ecën, s'ruhet asnjë shënim: ruhet vetëm çasti i nisjes dhe gjiri, te telefoni, që timeri të
 * mbijetojë mbylljen e app-it. Kur prindi shtyp "Ndalo", krijohet një shënim i zakonshëm ushqyerjeje (me kohën e
 * nisjes dhe kohëzgjatjen), që sinkronizohet si çdo shënim tjetër. Pa internet punon njësoj.
 *
 * Koha matet veçmas për çdo gji (segmente): ndërrimi i gjirit mbyll segmentin e njërit dhe hap tjetrin, kurse
 * pauza (bebja pushon, gromësin) e mbyll pa hapur të ri. Kohëzgjatja e ruajtur është vetëm koha e ushqyerjes, pa pauzat.
 */
export const BREAST_TIMER_KEY = "bebix_breast_timer_v1";
/** Gjiri ku mbaroi ushqyerja e fundit me të dy gjinjtë (për sugjerimin e herës tjetër). */
export const BREAST_LAST_END_KEY = "bebix_breast_last_end_v1";

type Side = "left" | "right";

export type BreastTimer = {
  startedAt: string;
  /** Gjiri aktual. */
  side: Side;
  /** Të gjithë gjinjtë e përdorur në këtë seancë (kur ndërrohet gjiri gjatë ushqyerjes). */
  sides: Side[];
  /** Milisekondat e segmenteve të mbyllura të çdo gjiri. Mungon te timerët e ruajtur nga versionet e vjetra. */
  doneMs?: { left: number; right: number };
  /** Nisja e segmentit që po ecën; null = në pauzë. Mungon = `startedAt` (timer i vjetër). */
  segmentAt?: string | null;
};

const ZERO = { left: 0, right: 0 };

export function startTimer(side: Side, now: Date = new Date()): BreastTimer {
  const at = now.toISOString();
  return { startedAt: at, side, sides: [side], doneMs: { ...ZERO }, segmentAt: at };
}

export function isPaused(timer: BreastTimer): boolean {
  return timer.segmentAt === null;
}

/** Milisekondat e çdo gjiri deri në `now`: segmentet e mbyllura plus ai që po ecën. */
function sideMs(timer: BreastTimer, now: Date): { left: number; right: number } {
  const done = timer.doneMs ?? ZERO;
  const out = { left: done.left, right: done.right };
  if (!isPaused(timer)) {
    const from = new Date(timer.segmentAt ?? timer.startedAt).getTime();
    out[timer.side] += Math.max(0, now.getTime() - from);
  }
  return out;
}

/** Sekondat e çdo gjiri (për orët te rrathët e gjinjve). */
export function sideSeconds(timer: BreastTimer, now: Date = new Date()): { left: number; right: number } {
  const ms = sideMs(timer, now);
  return { left: Math.floor(ms.left / 1000), right: Math.floor(ms.right / 1000) };
}

/** Sekondat e ushqyerjes (pa pauzat), për orën në ekran. */
export function elapsedSeconds(timer: BreastTimer, now: Date = new Date()): number {
  const ms = sideMs(timer, now);
  return Math.floor((ms.left + ms.right) / 1000);
}

/** Kalon te gjiri tjetër (ose vazhdon pas pauzës te gjiri i prekur). */
export function switchSide(timer: BreastTimer, side: Side, now: Date = new Date()): BreastTimer {
  return {
    ...timer,
    side,
    sides: timer.sides.includes(side) ? timer.sides : [...timer.sides, side],
    doneMs: sideMs(timer, now),
    segmentAt: now.toISOString(),
  };
}

export function pauseTimer(timer: BreastTimer, now: Date = new Date()): BreastTimer {
  if (isPaused(timer)) return timer;
  return { ...timer, doneMs: sideMs(timer, now), segmentAt: null };
}

export function resumeTimer(timer: BreastTimer, now: Date = new Date()): BreastTimer {
  if (!isPaused(timer)) return timer;
  return { ...timer, segmentAt: now.toISOString() };
}

/**
 * Çasti nga i cili një orë që numëron pa ndalim tregon kohën e saktë (widget-i, Live Activity); null në pauzë.
 * Pa pauza dhe pa ndërrime është vetë `startedAt`.
 */
export function runningSince(timer: BreastTimer, now: Date = new Date()): string | null {
  if (isPaused(timer)) return null;
  const done = timer.doneMs ?? ZERO;
  const segment = timer.segmentAt ?? timer.startedAt;
  if (done.left + done.right === 0 && segment === timer.startedAt) return timer.startedAt;
  const ms = sideMs(timer, now);
  return new Date(now.getTime() - (ms.left + ms.right)).toISOString();
}

/** "mm:ss" (ose "h:mm:ss" pas një ore). */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type FinishedTimer = {
  at: string;
  durationMin: number | null;
  side: BreastSide;
  /** Minutat e çdo gjiri (të rrumbullakosura). */
  leftMin: number;
  rightMin: number;
  /** Gjiri ku mbaroi ushqyerja. */
  endedOn: Side;
};

/**
 * Shënimi që krijohet kur ndalet timeri: koha e nisjes, kohëzgjatja në minuta (të paktën 1 kur ka zgjatur të paktën
 * gjysmë minute) dhe gjiri. "both" vetëm kur të dy gjinjtë kanë pasur të paktën gjysmë minute: një prekje e gabuar
 * te gjiri tjetër në fund s'e bën ushqyerjen "të dyja".
 */
export function finishTimer(timer: BreastTimer, now: Date = new Date()): FinishedTimer {
  const per = sideSeconds(timer, now);
  const secs = per.left + per.right;
  const durationMin = secs < 30 ? null : Math.max(1, Math.round(secs / 60));
  const used = (["left", "right"] as const).filter((s) => per[s] >= 30);
  const side: BreastSide = used.length === 2 ? "both" : used[0] ?? timer.side;
  return {
    at: timer.startedAt,
    durationMin,
    side,
    leftMin: Math.round(per.left / 60),
    rightMin: Math.round(per.right / 60),
    endedOn: timer.side,
  };
}

const validIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

/** Timeri i ruajtur, ose null kur s'ka (ose kur është i prishur / më i vjetër se 6 orë: harruar i ndezur). */
export function parseTimer(raw: string | null, now: Date = new Date()): BreastTimer | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<BreastTimer>;
    if (!v.startedAt || (v.side !== "left" && v.side !== "right")) return null;
    const started = new Date(v.startedAt).getTime();
    if (Number.isNaN(started) || now.getTime() - started > 6 * 3600_000 || started > now.getTime() + 60_000) return null;
    const sides = Array.isArray(v.sides) ? v.sides.filter((s): s is Side => s === "left" || s === "right") : [v.side];
    const timer: BreastTimer = { startedAt: v.startedAt, side: v.side, sides: sides.length ? sides : [v.side] };
    const d = v.doneMs;
    if (d && typeof d.left === "number" && typeof d.right === "number") {
      timer.doneMs = { left: Math.max(0, d.left), right: Math.max(0, d.right) };
    }
    if (v.segmentAt === null) timer.segmentAt = null;
    else if (validIso(v.segmentAt)) timer.segmentAt = v.segmentAt;
    return timer;
  } catch {
    return null;
  }
}

export async function loadTimer(): Promise<BreastTimer | null> {
  try {
    return parseTimer(await AsyncStorage.getItem(BREAST_TIMER_KEY));
  } catch {
    return null;
  }
}

/** Njofton widget-in që timeri nisi, ndërroi gji ose u ndal. */
export const BREAST_TIMER_EVENT = "bebixBreastTimer";

export async function saveTimer(timer: BreastTimer | null): Promise<void> {
  try {
    if (timer) await AsyncStorage.setItem(BREAST_TIMER_KEY, JSON.stringify(timer));
    else await AsyncStorage.removeItem(BREAST_TIMER_KEY);
  } catch {
    // Pa ruajtje: timeri vazhdon në ekran, por s'mbijeton mbylljen e app-it.
  }
  DeviceEventEmitter.emit(BREAST_TIMER_EVENT);
}

export async function loadLastEnd(): Promise<Side | null> {
  try {
    const v = await AsyncStorage.getItem(BREAST_LAST_END_KEY);
    return v === "left" || v === "right" ? v : null;
  } catch {
    return null;
  }
}

export async function saveLastEnd(side: Side): Promise<void> {
  try {
    await AsyncStorage.setItem(BREAST_LAST_END_KEY, side);
  } catch {
    // Pa ruajtje: sugjerimi bie te rregulli i thjeshtë (tjetri nga i fundit).
  }
}

/**
 * Gjiri që sugjerohet herën tjetër. Pas një gjiri: tjetri (rregulli i zakonshëm i ndërrimit). Pas të dyve: ai ku mbaroi
 * ushqyerja, sepse u zbraz më pak (kur dihet, `endedOn`).
 */
export function suggestedSide(last: BreastSide | null | undefined, endedOn?: Side | null): Side {
  if (last === "both" && endedOn) return endedOn;
  return last === "left" ? "right" : "left";
}
