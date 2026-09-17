import type { TranslationKey } from "@/lib/i18n/translations";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** "Tani", "5 min më parë", "3 orë më parë", "2 ditë më parë". */
export function timeAgoLabel(iso: string | null, t: T, now: number = Date.now()): string {
  if (!iso) return t("time_never");
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("time_now");
  if (mins < 60) return t("time_min_ago", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time_hr_ago", { n: hrs });
  return t("time_day_ago", { n: Math.floor(hrs / 24) });
}
