/**
 * Faqosja e librit: sa i madh është libri në ekran, a hapet me një faqe apo me dy (si libër i hapur), dhe si ndahet
 * teksti në faqe. Teksti s'ndahet sipas paragrafëve, por sipas rreshtave të matur në ekran: në telefon të vogël me
 * shkronja të mëdha përralla ka më shumë faqe, në tablet më pak, si në një libër të vërtetë.
 * Pa matje (p.sh. në web), çdo paragraf merr faqen e vet.
 */

export type BookMode = "single" | "spread";

export type BookMetrics = {
  mode: BookMode;
  /** Madhësia e një faqeje. */
  pageW: number;
  pageH: number;
  /** Hapësira e tekstit brenda faqes. */
  padX: number;
  padTop: number;
  padBottom: number;
  innerW: number;
  innerH: number;
  fontSize: number;
  lineHeight: number;
  /** Hapësira para çdo paragrafi të ri (jo në krye të faqes). */
  paragraphGap: number;
};

/** Madhësitë e tekstit për një faqe telefoni; në faqe më të gjera rriten pak. */
export const BASE_SIZES = [16, 18, 20, 23, 27] as const;
export const DEFAULT_SIZE = 2;

/** Dy faqe kur ka vend për dy faqe të lexueshme: tablet, telefon i palosshëm i hapur, ekran horizontal, web. */
export const SPREAD_MIN_WIDTH = 700;

export function bookMetrics(areaW: number, areaH: number, sizeStep: number): BookMetrics {
  const mode: BookMode = areaW >= SPREAD_MIN_WIDTH && areaW > areaH * 0.9 ? "spread" : areaW >= 900 ? "spread" : "single";
  const margin = areaW < 380 ? 10 : 16;
  const maxW = mode === "spread" ? Math.min(560, (areaW - margin * 2) / 2) : Math.min(600, areaW - margin * 2);
  const maxH = Math.max(240, areaH - margin * 2);
  // Faqja e librit: rreth 1:1.45, por e përshtatur te ekrani (telefonat e gjatë marrin faqe më të gjata).
  const pageW = Math.floor(Math.min(maxW, maxH / 1.2));
  const pageH = Math.floor(Math.min(maxH, pageW * 1.75));
  const padX = Math.round(Math.min(44, Math.max(18, pageW * 0.08)));
  const padTop = Math.round(Math.min(44, Math.max(20, pageH * 0.05)));
  const padBottom = padTop + 18;
  const scale = Math.min(1.25, Math.max(0.9, pageW / 380));
  const fontSize = Math.round(BASE_SIZES[Math.min(BASE_SIZES.length - 1, Math.max(0, sizeStep))] * scale);
  const lineHeight = Math.round(fontSize * 1.6);
  return {
    mode,
    pageW,
    pageH,
    padX,
    padTop,
    padBottom,
    innerW: pageW - padX * 2,
    innerH: pageH - padTop - padBottom,
    fontSize,
    lineHeight,
    paragraphGap: Math.round(lineHeight * 0.55),
  };
}

/** Një copë paragrafi në një faqe. `start` = shkronja e parë brenda paragrafit (për të ruajtur vendin e leximit). */
export type Block = { paragraph: number; start: number; text: string };

export type BookPage = { kind: "cover" } | { kind: "text"; blocks: Block[]; number: number } | { kind: "end" } | { kind: "blank" };

/** Vendi i leximit, i pavarur nga madhësia e faqes: kur ndryshon shkronja ose ekrani, libri hapet aty ku ishte. */
export type Anchor = { kind: "cover" } | { kind: "text"; paragraph: number; offset: number } | { kind: "end" };

/**
 * Rreshtat e matur → faqe teksti. Paragrafi s'lë një rresht të vetëm në fund të faqes; kur s'ka vend për dy rreshta,
 * kalon te faqja tjetër.
 */
export function packPages(lines: string[][], m: Pick<BookMetrics, "innerH" | "lineHeight" | "paragraphGap">): Block[][] {
  const pages: Block[][] = [];
  let page: Block[] = [];
  let used = 0;
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };
  lines.forEach((paraLines, paragraph) => {
    let i = 0;
    let offset = 0;
    while (i < paraLines.length) {
      const gap = page.length && i === 0 ? m.paragraphGap : 0;
      const room = Math.floor((m.innerH - used - gap) / m.lineHeight);
      const left = paraLines.length - i;
      const minFit = left >= 2 ? 2 : 1;
      if (room < minFit && page.length) {
        flush();
        continue;
      }
      const take = Math.max(1, Math.min(left, room));
      // S'lihet një rresht i vetëm në krye të faqes tjetër kur mund të merret me vete.
      const n = left - take === 1 && take > 2 ? take - 1 : take;
      const text = paraLines.slice(i, i + n).join("");
      page.push({ paragraph, start: offset, text: text.replace(/\s+$/, "") });
      offset += text.length;
      used += gap + n * m.lineHeight;
      i += n;
      if (i < paraLines.length) flush();
    }
  });
  flush();
  return pages;
}

/**
 * Rreshtat e matur nga telefoni → copa të sakta të paragrafit origjinal (me hapësirat). Telefonat i japin rreshtat
 * ndryshe (me ose pa hapësirën në fund); copat merren nga teksti origjinal, që asnjë shkronjë të mos humbasë.
 * null kur rreshtat s'përputhen me tekstin (p.sh. ndarje fjalësh me vizë): atëherë një paragraf në faqe.
 */
export function linesToSlices(paragraph: string, lineTexts: string[]): string[] | null {
  const starts: number[] = [];
  let cursor = 0;
  for (const line of lineTexts) {
    const t = line.trim();
    if (!t) continue;
    const at = paragraph.indexOf(t, cursor);
    if (at < 0 || (starts.length === 0 && paragraph.slice(0, at).trim())) return null;
    starts.push(at);
    cursor = at + t.length;
  }
  if (!starts.length || paragraph.slice(cursor).trim()) return null;
  return starts.map((s, i) => paragraph.slice(i === 0 ? 0 : s, starts[i + 1] ?? paragraph.length));
}

/** Pa matje: një paragraf në faqe. */
export function paragraphPages(paragraphs: string[]): Block[][] {
  return paragraphs.map((text, paragraph) => [{ paragraph, start: 0, text }]);
}

/** Kopertina, faqet e tekstit, fundi; me dy faqe, numri i faqeve bëhet çift. */
export function buildBook(textPages: Block[][], mode: BookMode): BookPage[] {
  const pages: BookPage[] = [{ kind: "cover" }, ...textPages.map((blocks, i) => ({ kind: "text" as const, blocks, number: i + 1 })), { kind: "end" }];
  if (mode === "spread" && pages.length % 2) pages.splice(pages.length - 1, 0, { kind: "blank" });
  return pages;
}

/** Sa pozicione ka libri: faqe (një faqe) ose çifte faqesh (dy faqe). */
export function positionCount(pages: BookPage[], mode: BookMode): number {
  return mode === "spread" ? Math.ceil(pages.length / 2) : pages.length;
}

export function anchorOfPosition(pages: BookPage[], mode: BookMode, position: number): Anchor {
  const shown = mode === "spread" ? [pages[position * 2], pages[position * 2 + 1]] : [pages[position]];
  for (const p of shown) {
    if (!p) continue;
    if (p.kind === "text") return { kind: "text", paragraph: p.blocks[0].paragraph, offset: p.blocks[0].start };
    if (p.kind === "end") return { kind: "end" };
  }
  return shown.some((p) => p?.kind === "cover") ? { kind: "cover" } : { kind: "end" };
}

export function positionOfAnchor(pages: BookPage[], mode: BookMode, anchor: Anchor): number {
  const toPosition = (pageIndex: number) => (mode === "spread" ? Math.floor(pageIndex / 2) : pageIndex);
  if (anchor.kind === "cover") return 0;
  if (anchor.kind === "end") return toPosition(pages.findIndex((p) => p.kind === "end"));
  // Faqja e fundit që nis para ose te vendi i leximit.
  let best = pages.findIndex((p) => p.kind === "text");
  pages.forEach((p, i) => {
    if (p.kind !== "text") return;
    const b = p.blocks[0];
    if (b.paragraph < anchor.paragraph || (b.paragraph === anchor.paragraph && b.start <= anchor.offset)) best = i;
  });
  return toPosition(Math.max(0, best));
}

/** Faqet që shihen në një pozicion (numrat nga 1), për "Faqja 3 nga 12". */
export function visiblePageNumbers(pages: BookPage[], mode: BookMode, position: number): number[] {
  return mode === "spread" ? [position * 2 + 1, Math.min(pages.length, position * 2 + 2)] : [position + 1];
}
