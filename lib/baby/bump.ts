import type { Moment } from "@/lib/state/babyTypes";

/**
 * Barku javë pas jave: fotot janë momente të zakonshme me etiketat "bump" dhe "week:<n>". S'ka tabelë të re:
 * sinkronizohen dhe ruhen si çdo foto tjetër, dalin edhe te Momentet dhe mund të ndahen te karta e javës.
 */
export const BUMP_TAG = "bump";

export function bumpTags(week: number): string[] {
  return [BUMP_TAG, `week:${week}`];
}

export function bumpWeek(m: Pick<Moment, "tags">): number | null {
  if (!m.tags?.includes(BUMP_TAG)) return null;
  const tag = m.tags.find((t) => /^week:\d{1,2}$/.test(t));
  const n = tag ? Number(tag.slice(5)) : NaN;
  return n >= 1 && n <= 42 ? n : null;
}

/** Fotot e barkut (pa të fshirat), java më e re e para; brenda javës, më e reja e para. */
export function bumpPhotos(moments: Moment[]): { moment: Moment; week: number }[] {
  return moments
    .filter((m) => m.type === "photo" && !m.deletedAt && !m.archivedAt && (m.uri || m.storagePath))
    .map((moment) => ({ moment, week: bumpWeek(moment) }))
    .filter((x): x is { moment: Moment; week: number } => x.week != null)
    .sort((a, b) => b.week - a.week || (a.moment.date < b.moment.date ? 1 : -1));
}
