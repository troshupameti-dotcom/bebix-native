import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Furnizimi në shtëpi (pelenat, formula): prindi vendos një herë sa ka; Bebix heq vetë një për çdo shënim te
 * ditari dhe e di kur po mbaron, para se të mbarojë vërtet. Ruhet vetëm në telefon (s'është e dhënë për serverin).
 */
export type SupplyStock = { remaining: number; setAt: string };

export type SupplyEstimate = {
  /** Sa mbeten tani (sa u vendos, minus ato të shënuara pas asaj kohe). */
  left: number;
  /** Mesatarja e përdorimit në ditë, nga ditari i fundit; null kur s'ka të dhëna. */
  perDay: number | null;
  /** Sa ditë mjafton; null kur s'ka mesatare. */
  daysLeft: number | null;
  /** A duhet porositur tani. */
  low: boolean;
};

/** Kur quhet "po mbaron": nën `count` copë, ose kur mjafton për `days` ditë ose më pak. */
export type SupplyThreshold = { count: number; days: number };

const DAY = 86_400_000;

export function estimateSupply(stock: SupplyStock, entries: { at: string }[], low: SupplyThreshold, now: number = Date.now()): SupplyEstimate {
  const since = new Date(stock.setAt).getTime();
  const used = entries.filter((e) => new Date(e.at).getTime() > since).length;
  const left = Math.max(0, stock.remaining - used);

  // Mesatarja: 3 ditët e fundit; kur s'ka, 7 ditët; kur s'ka, asgjë.
  const within = (days: number) => entries.filter((e) => now - new Date(e.at).getTime() <= days * DAY).length;
  const last3 = within(3);
  const last7 = within(7);
  const perDay = last3 > 0 ? last3 / 3 : last7 > 0 ? last7 / 7 : null;

  const daysLeft = perDay ? left / perDay : null;
  return { left, perDay, daysLeft, low: left <= low.count || (daysLeft !== null && daysLeft <= low.days) };
}

export async function loadSupply(key: string): Promise<SupplyStock | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupplyStock>;
    return typeof parsed.remaining === "number" && typeof parsed.setAt === "string" ? { remaining: parsed.remaining, setAt: parsed.setAt } : null;
  } catch {
    return null;
  }
}

export async function saveSupply(key: string, remaining: number): Promise<SupplyStock> {
  const stock: SupplyStock = { remaining: Math.max(0, Math.min(2000, Math.round(remaining))), setAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(stock));
  } catch {
    // Pa ruajtje lokale, vlera mbetet vetëm gjatë kësaj seance.
  }
  return stock;
}
