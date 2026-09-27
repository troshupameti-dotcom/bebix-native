import type { Href } from "expo-router";
import type { IconName } from "@/components/ui/Icon";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { BabyModuleState, NotificationPrefs } from "@/lib/state/types";
import { computeVaccineStatus } from "@/lib/baby/vaccineStatus";
import { isNotificationEnabled } from "@/lib/notifications/catalog";
import { formatTime } from "@/lib/dateUtils";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type InboxItem = {
  /**
   * I qëndrueshëm për të njëjtën ngjarje, që "lexuar" të mbahet mend. Ndryshon
   * kur ngjarja ndryshon (p.sh. regjistrohet një ushqyerje e re), dhe atëherë
   * kujtesa e re del si e palexuar.
   */
  id: string;
  icon: IconName;
  accent: "olive" | "orange";
  title: string;
  body: string;
  /** Kur u bë e rëndësishme kujtesa — për renditje dhe "x orë më parë". */
  at: string;
  route: Href;
};

/** Regjistrimet aktive (jo te fshira, jo te arkivuara). */
function active<R extends { deletedAt: string | null; archivedAt: string | null }>(list: R[]): R[] {
  return list.filter((r) => !r.deletedAt && !r.archivedAt);
}

const HOUR = 3600000;
const DAY = 24 * HOUR;

/**
 * Pas sa kohësh del kujtesa. Ushqyerja dhe pelenat vijnë nga cilësimet e
 * prindit (prefs.feedingGapH / diaperGapH), njësoj si kujtesat nga serveri.
 */
export const INBOX_THRESHOLDS = {
  awakeHours: 3,
  vaccineWindowDays: 7,
};

type Input = {
  baby: BabyModuleState;
  prefs: NotificationPrefs;
  t: T;
  lang: "sq" | "en";
  now?: Date;
};

/**
 * Ndërton njoftimet nga historiku real i bebit. Funksion i pastër: e njëjta
 * hyrje jep të njëjtin rezultat, pa rrjet dhe pa gjendje të fshehur.
 *
 * Respekton cilësimet te Më shumë → Njoftimet (vaksina, ushqyerje, gjumë).
 * Pelenat s'kanë cilësim të vetin dhe dalin gjithmonë.
 */
export function buildInbox({ baby, prefs, t, lang, now = new Date() }: Input): InboxItem[] {
  const items: InboxItem[] = [];
  const nowMs = now.getTime();

  // ---- Vaksinat ----
  if (isNotificationEnabled(prefs, "baby_vaccine")) {
    for (const v of active(baby.vaccines)) {
      if (!v.reminderEnabled) continue;
      const status = computeVaccineStatus(v, now);
      const dueMs = new Date(v.dueDate).getTime();

      if (status === "overdue") {
        items.push({
          id: `vaccine:${v.id}:overdue`,
          icon: "syringe",
          accent: "orange",
          title: t("inbox_vaccine_overdue_title"),
          body: v.name,
          at: v.dueDate,
          route: "/(main)/baby/vaccinations",
        });
      } else if (status === "due_today") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        items.push({
          id: `vaccine:${v.id}:today`,
          icon: "syringe",
          accent: "orange",
          title: t("inbox_vaccine_today_title"),
          body: v.name,
          at: startOfDay.toISOString(),
          route: "/(main)/baby/vaccinations",
        });
      } else if (status === "upcoming" && dueMs - nowMs <= INBOX_THRESHOLDS.vaccineWindowDays * DAY) {
        const days = Math.max(1, Math.ceil((dueMs - nowMs) / DAY));
        items.push({
          id: `vaccine:${v.id}:soon`,
          icon: "syringe",
          accent: "olive",
          title: t("inbox_vaccine_soon_title"),
          body: t("inbox_vaccine_soon_body", { name: v.name, n: days }),
          // Hyri në dritaren 7-ditore në këtë moment.
          at: new Date(Math.min(nowMs, dueMs - INBOX_THRESHOLDS.vaccineWindowDays * DAY)).toISOString(),
          route: "/(main)/baby/vaccinations",
        });
      }
    }
  }

  // ---- Ushqyerja (ilaçet s'numërohen si ushqyerje) ----
  if (isNotificationEnabled(prefs, "baby_feeding")) {
    const last = active(baby.feedingLog).find((f) => f.type !== "medicine");
    if (last) {
      const hours = Math.floor((nowMs - new Date(last.at).getTime()) / HOUR);
      if (hours >= prefs.feedingGapH) {
        items.push({
          id: `feeding:${last.id}`,
          icon: "spoon",
          accent: "orange",
          title: t("inbox_feeding_title", { n: hours }),
          body: t("inbox_feeding_body", { time: formatTime(last.at, lang) }),
          at: new Date(new Date(last.at).getTime() + prefs.feedingGapH * HOUR).toISOString(),
          route: "/(main)/baby/feeding",
        });
      }
    }
  }

  // ---- Gjumi: sa kohë zgjuar që nga gjumi i fundit i mbaruar ----
  if (isNotificationEnabled(prefs, "baby_sleep")) {
    const lastSleep = active(baby.sleepLog)[0];
    if (lastSleep?.endAt) {
      const hours = Math.floor((nowMs - new Date(lastSleep.endAt).getTime()) / HOUR);
      if (hours >= INBOX_THRESHOLDS.awakeHours) {
        items.push({
          id: `sleep:${lastSleep.id}`,
          icon: "moon",
          accent: "olive",
          title: t("inbox_sleep_title", { n: hours }),
          body: t("inbox_sleep_body"),
          at: new Date(new Date(lastSleep.endAt).getTime() + INBOX_THRESHOLDS.awakeHours * HOUR).toISOString(),
          route: "/(main)/baby/sleep",
        });
      }
    }
  }

  // ---- Pelenat ----
  const lastDiaper = active(baby.diaperLog)[0];
  if (lastDiaper) {
    const hours = Math.floor((nowMs - new Date(lastDiaper.at).getTime()) / HOUR);
    if (hours >= prefs.diaperGapH) {
      items.push({
        id: `diaper:${lastDiaper.id}`,
        icon: "diaper",
        accent: "olive",
        title: t("inbox_diaper_title", { n: hours }),
        body: t("inbox_diaper_body"),
        at: new Date(new Date(lastDiaper.at).getTime() + prefs.diaperGapH * HOUR).toISOString(),
        route: "/(main)/baby/diaper",
      });
    }
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}
