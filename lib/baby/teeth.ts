import type { TimelineEvent } from "@/lib/state/babyTypes";

/**
 * Dhëmbët e qumështit (20): cili doli dhe kur.
 *
 * S'ka tabelë të re: çdo dhëmb ruhet si ngjarje e historikut (`timeline`) me id "tooth-<kodi>-<unik>". Kështu
 * sinkronizohet me familjen si çdo ngjarje tjetër, del te ditari, te kujtimet e muajit dhe te libri i vitit të parë.
 * Id-ja duhet të jetë unike edhe mes fëmijëve, sepse serveri i ruan me (user_id, id).
 *
 * Kodi: nofulla (U sipër, L poshtë), ana e bebit (R djathtas, L majtas), pozicioni nga mesi (1 incizivi qendror
 * … 5 molari i dytë). P.sh. "LR1" = incizivi qendror i poshtëm, djathtas.
 */
export type Jaw = "U" | "L";
export type Side = "R" | "L";
export type ToothPos = 1 | 2 | 3 | 4 | 5;
export type ToothCode = `${Jaw}${Side}${ToothPos}`;

/** Mosha e zakonshme e daljes, në muaj (ADA / AAP). Të dyja anët dalin zakonisht afër njëra-tjetrës. */
export const ERUPTION: Record<Jaw, Record<ToothPos, [number, number]>> = {
  U: { 1: [8, 12], 2: [9, 13], 3: [16, 22], 4: [13, 19], 5: [25, 33] },
  L: { 1: [6, 10], 2: [10, 16], 3: [17, 23], 4: [14, 18], 5: [23, 31] },
};

const POSITIONS: ToothPos[] = [1, 2, 3, 4, 5];

/** Rreshti i dhëmbëve si i sheh prindi përballë bebit: ana e djathtë e bebit majtas, molarët në skaje. */
export function jawRow(jaw: Jaw): ToothCode[] {
  const right = [...POSITIONS].reverse().map((p) => `${jaw}R${p}` as ToothCode);
  const left = POSITIONS.map((p) => `${jaw}L${p}` as ToothCode);
  return [...right, ...left];
}

export const ALL_TEETH: ToothCode[] = [...jawRow("U"), ...jawRow("L")];

export function parseTooth(code: ToothCode): { jaw: Jaw; side: Side; pos: ToothPos } {
  return { jaw: code[0] as Jaw, side: code[1] as Side, pos: Number(code[2]) as ToothPos };
}

export function eruptionRange(code: ToothCode): [number, number] {
  const { jaw, pos } = parseTooth(code);
  return ERUPTION[jaw][pos];
}

const ID_RE = /^tooth-([UL][RL][1-5])-/;

export function toothEventId(code: ToothCode, unique: string = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)): string {
  return `tooth-${code}-${unique}`;
}

export function toothCodeOf(eventId: string): ToothCode | null {
  const m = ID_RE.exec(eventId);
  return m ? (m[1] as ToothCode) : null;
}

/** Dhëmbët që kanë dalë, sipas ngjarjeve aktive (pa të fshirat). Kur ka dy për të njëjtin dhëmb, mbahet e para. */
export function eruptedTeeth(timeline: TimelineEvent[]): Map<ToothCode, TimelineEvent> {
  const out = new Map<ToothCode, TimelineEvent>();
  const sorted = timeline.filter((e) => !e.deletedAt && !e.archivedAt).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const e of sorted) {
    const code = toothCodeOf(e.id);
    if (code && !out.has(code)) out.set(code, e);
  }
  return out;
}

/**
 * Dhëmbët që zakonisht dalin tani (mosha brenda intervalit, ose deri 3 muaj pas tij), por s'janë shënuar ende.
 * Një për çdo palë (majtas/djathtas kanë të njëjtin emër), me radhën e daljes.
 */
export function dueNow(erupted: Set<ToothCode>, months: number | null): ToothCode[] {
  if (months == null) return [];
  const seen = new Set<string>();
  const out: ToothCode[] = [];
  const order = [...ALL_TEETH].sort((a, b) => eruptionRange(a)[0] - eruptionRange(b)[0]);
  for (const code of order) {
    const [from, to] = eruptionRange(code);
    const pair = code[0] + code[2];
    if (erupted.has(code) || seen.has(pair)) continue;
    if (months >= from && months <= to + 3) {
      seen.add(pair);
      out.push(code);
    }
  }
  return out;
}

/** Pas 18 muajsh pa asnjë dhëmb, ia vlen të pyesësh pediatrin ose dentistin. */
export function lateFirstTooth(eruptedCount: number, months: number | null): boolean {
  return months != null && months >= 18 && eruptedCount === 0;
}
