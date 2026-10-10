import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Pas lindjes (12 javët e para), për mamin: një këshillë e shkurtër çdo
 * javë dhe kujtesa që i ndez vetë (ujë, vitamina, ushtrime, kontrolli i
 * javës së 6-të). Kujtesat janë njoftime lokale të telefonit.
 */

export const POSTPARTUM_WEEKS = 12;
const DAY = 86_400_000;

function birth(dob: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Java pas lindjes (1–12) për mamin; null për të tjerët ose pas javës 12. */
export function postpartumWeek(dob: string | null, relation: string | null | undefined, now: Date = new Date()): number | null {
  if (relation !== "mom") return null;
  const born = birth(dob);
  if (!born || born > now) return null;
  const week = Math.floor((now.getTime() - born.getTime()) / (7 * DAY)) + 1;
  return week >= 1 && week <= POSTPARTUM_WEEKS ? week : null;
}

export const weekTipKey = (week: number) => `pp_week_${Math.min(POSTPARTUM_WEEKS, Math.max(1, week))}` as TranslationKey;

export type ReminderKey = "water" | "vitamins" | "pelvic" | "checkup";

export type ReminderPreset = { key: ReminderKey; labelKey: TranslationKey; bodyKey: TranslationKey; hour: number; minute: number; once?: true };

/** Orët janë jashtë orëve të qeta (22:00–07:00). */
export const REMINDERS: ReminderPreset[] = [
  { key: "vitamins", labelKey: "pp_rem_vitamins", bodyKey: "pp_rem_vitamins_body", hour: 9, minute: 0 },
  { key: "water", labelKey: "pp_rem_water", bodyKey: "pp_rem_water_body", hour: 11, minute: 0 },
  { key: "pelvic", labelKey: "pp_rem_pelvic", bodyKey: "pp_rem_pelvic_body", hour: 18, minute: 0 },
  { key: "checkup", labelKey: "pp_rem_checkup", bodyKey: "pp_rem_checkup_body", hour: 10, minute: 0, once: true },
];

/** Kontrolli pas lindjes: rreth javës së 6-të; kujtesa një ditë para, në 10:00. Null kur ka kaluar. */
export function checkupReminderDate(dob: string | null, now: Date = new Date()): Date | null {
  const born = birth(dob);
  if (!born) return null;
  const d = new Date(born.getFullYear(), born.getMonth(), born.getDate() + 41, 10, 0);
  return d > now ? d : null;
}

// --- Cilat kujtesa janë ndezur (në telefon) ---------------------------------

const KEY = "bebix_postpartum_reminders_v1";
let enabled: ReminderKey[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setReminderEnabled(key: ReminderKey, on: boolean) {
  enabled = on ? [...new Set([...enabled, key])] : enabled.filter((k) => k !== key);
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(enabled)).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  if (!loaded) {
    loaded = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        enabled = raw ? (JSON.parse(raw) as ReminderKey[]) : [];
        emit();
      })
      .catch(() => {});
  }
  return () => listeners.delete(l);
};

export function useEnabledReminders(): ReminderKey[] {
  return useSyncExternalStore(subscribe, () => enabled);
}
