import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BreastSide } from "@/lib/state/babyTypes";

/**
 * Timeri i gjidhënies (start/stop si te gjumi).
 *
 * Gjatë kohës që timeri ecën, s'ruhet asnjë shënim: ruhet vetëm çasti i nisjes dhe gjiri, te telefoni, që timeri të
 * mbijetojë mbylljen e app-it. Kur prindi shtyp "Ndalo", krijohet një shënim i zakonshëm ushqyerjeje (me kohën e
 * nisjes dhe kohëzgjatjen), që sinkronizohet si çdo shënim tjetër. Pa internet punon njësoj.
 */
export const BREAST_TIMER_KEY = "bebix_breast_timer_v1";

export type BreastTimer = {
  startedAt: string;
  /** Gjiri aktual. */
  side: "left" | "right";
  /** Të gjithë gjinjtë e përdorur në këtë seancë (kur ndërrohet gjiri gjatë ushqyerjes). */
  sides: ("left" | "right")[];
};

export function startTimer(side: "left" | "right", now: Date = new Date()): BreastTimer {
  return { startedAt: now.toISOString(), side, sides: [side] };
}

export function switchSide(timer: BreastTimer, side: "left" | "right"): BreastTimer {
  return { ...timer, side, sides: timer.sides.includes(side) ? timer.sides : [...timer.sides, side] };
}

/** Sekondat që nga nisja (për orën në ekran). */
export function elapsedSeconds(timer: BreastTimer, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(timer.startedAt).getTime()) / 1000));
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

/**
 * Shënimi që krijohet kur ndalet timeri: koha e nisjes, kohëzgjatja në minuta (të paktën 1 kur ka zgjatur të paktën
 * gjysmë minute) dhe gjiri ("both" kur janë përdorur të dy).
 */
export function finishTimer(timer: BreastTimer, now: Date = new Date()): { at: string; durationMin: number | null; side: BreastSide } {
  const secs = elapsedSeconds(timer, now);
  const durationMin = secs < 30 ? null : Math.max(1, Math.round(secs / 60));
  const side: BreastSide = timer.sides.length > 1 ? "both" : timer.side;
  return { at: timer.startedAt, durationMin, side };
}

/** Timeri i ruajtur, ose null kur s'ka (ose kur është i prishur / më i vjetër se 6 orë: harruar i ndezur). */
export function parseTimer(raw: string | null, now: Date = new Date()): BreastTimer | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<BreastTimer>;
    if (!v.startedAt || (v.side !== "left" && v.side !== "right")) return null;
    const started = new Date(v.startedAt).getTime();
    if (Number.isNaN(started) || now.getTime() - started > 6 * 3600_000 || started > now.getTime() + 60_000) return null;
    const sides = Array.isArray(v.sides) ? v.sides.filter((s): s is "left" | "right" => s === "left" || s === "right") : [v.side];
    return { startedAt: v.startedAt, side: v.side, sides: sides.length ? sides : [v.side] };
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

export async function saveTimer(timer: BreastTimer | null): Promise<void> {
  try {
    if (timer) await AsyncStorage.setItem(BREAST_TIMER_KEY, JSON.stringify(timer));
    else await AsyncStorage.removeItem(BREAST_TIMER_KEY);
  } catch {
    // Pa ruajtje: timeri vazhdon në ekran, por s'mbijeton mbylljen e app-it.
  }
}

/** Gjiri që sugjerohet herën tjetër: tjetri nga i fundit (rregulli i zakonshëm i ndërrimit). */
export function suggestedSide(last: BreastSide | null | undefined): "left" | "right" {
  return last === "left" ? "right" : "left";
}
