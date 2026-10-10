/**
 * Gjumë nate apo sy gjumë? Kur prindi s'zgjedh vetë (butoni i shpejtë në
 * Home, widget-i, lidhja bebix://sleep/toggle), vendos ora e nisjes.
 * Kufijtë janë parametra që të bëhen cilësim më vonë.
 */
export type NightWindow = { startHour: number; endHour: number };

/** Nata: 19:00–07:00. */
export const DEFAULT_NIGHT: NightWindow = { startHour: 19, endHour: 7 };

export function isNightSleep(startAt: Date | string, night: NightWindow = DEFAULT_NIGHT): boolean {
  const d = typeof startAt === "string" ? new Date(startAt) : startAt;
  const h = d.getHours();
  if (Number.isNaN(h)) return false;
  return night.startHour > night.endHour
    ? h >= night.startHour || h < night.endHour
    : h >= night.startHour && h < night.endHour;
}

/** Vlera për `startSleep(isNap, …)`. */
export const isNapAt = (startAt: Date | string, night?: NightWindow) => !isNightSleep(startAt, night);
