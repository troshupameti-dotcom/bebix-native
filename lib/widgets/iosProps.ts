import type { WidgetSnapshot } from "@/lib/widgets/snapshot";
import { clockLabel, diaperLabel, feedingLabel, wt } from "@/lib/widgets/texts";

/**
 * Të dhënat për widget-in dhe Live Activity të iPhone-it (expo-widgets).
 * Widget-i i iOS-it vizatohet jashtë app-it dhe s'ka përkthime, ndaj app-i i
 * dërgon tekstet gati, në gjuhën e prindit. Kohët shkojnë si ISO: widget-i i
 * shfaq vetë si "para 2 orësh" / timer që numëron.
 */

export type IosWidgetProps = {
  title: string;
  feeding: { label: string; value: string; detail: string; since: string | null };
  diaper: { label: string; value: string; detail: string; since: string | null };
  sleep: { label: string; value: string; detail: string; since: string | null; asleep: boolean };
  actions: { wet: string; dirty: string; sleep: string };
};

export function buildIosWidgetProps(s: WidgetSnapshot, now: Date = new Date()): IosWidgetProps {
  const lang = s.lang;
  const none = wt(lang, "widget_none");
  const next = s.nextFeedingAt && new Date(s.nextFeedingAt).getTime() > now.getTime() ? s.nextFeedingAt : null;
  return {
    title: s.babyName ? `Bebix · ${s.babyName}` : "Bebix",
    feeding: {
      label: wt(lang, "widget_feeding"),
      value: s.breastSince ? clockLabel(s.breastSince, now) : s.feeding ? clockLabel(s.feeding.at, now) : none,
      detail: s.breastSince
        ? wt(lang, "widget_breast_running")
        : next
          ? wt(lang, "widget_next", { time: clockLabel(next, now) })
          : s.feeding
            ? feedingLabel(lang, s.feeding.type)
            : "",
      since: s.breastSince ?? s.feeding?.at ?? null,
    },
    diaper: {
      label: wt(lang, "widget_diaper"),
      value: s.diaper ? clockLabel(s.diaper.at, now) : none,
      detail: s.diaper ? diaperLabel(lang, s.diaper.type) : "",
      since: s.diaper?.at ?? null,
    },
    sleep: {
      label: wt(lang, "widget_sleep"),
      value: s.sleep ? clockLabel(s.sleep.since, now) : s.lastWakeAt ? clockLabel(s.lastWakeAt, now) : none,
      detail: s.sleep ? wt(lang, "widget_asleep") : s.lastWakeAt ? wt(lang, "widget_awake") : "",
      since: s.sleep?.since ?? s.lastWakeAt ?? null,
      asleep: !!s.sleep,
    },
    actions: {
      wet: diaperLabel(lang, "wet"),
      dirty: diaperLabel(lang, "dirty"),
      sleep: wt(lang, s.sleep ? "widget_sleep_end" : "widget_sleep_start"),
    },
  };
}

export type LiveActivityProps = {
  kind: "sleep" | "breast";
  title: string;
  subtitle: string;
  /** Nisja: Live Activity numëron vetë prej saj (Text me dateStyle "timer"). */
  startedAt: string;
};

/**
 * Live Activity që duhet të jetë aktive tani: gjiri ka përparësi (zgjat pak
 * dhe prindi e ndal me dorë), pastaj gjumi në vazhdim. null = asnjë.
 */
export function desiredLiveActivity(s: WidgetSnapshot | null): LiveActivityProps | null {
  if (!s) return null;
  const name = s.babyName ?? "Bebix";
  if (s.breastSince) {
    return { kind: "breast", title: wt(s.lang, "widget_breast_running"), subtitle: name, startedAt: s.breastSince };
  }
  if (s.sleep) {
    return { kind: "sleep", title: wt(s.lang, "widget_asleep"), subtitle: name, startedAt: s.sleep.since };
  }
  return null;
}

/** A duhet rinisur Live Activity (lloj ose nisje tjetër), apo mjafton ta lëmë si është. */
export function sameActivity(a: LiveActivityProps | null, b: LiveActivityProps | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.startedAt === b.startedAt && a.title === b.title && a.subtitle === b.subtitle;
}
