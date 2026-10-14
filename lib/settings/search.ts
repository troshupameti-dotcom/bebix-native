/**
 * Kërkimi te Cilësimet. Shumë prindër shkruajnë pa "ë" dhe "ç" (tastiera pa to, ose me një dorë natën), ndaj
 * "nate" gjen "Modaliteti i natës" dhe "cilesimet" gjen "Cilësimet". Çdo rresht ka edhe fjalë të afërta
 * (p.sh. "errët", "dark" te Pamja), që kërkimi të gjejë edhe kur prindi s'e di emrin e saktë.
 */

export type Searchable = { label: string; keywords?: string };

/** Pa shkronja të mëdha dhe pa shenja: "Natës" → "nates", "Çfarë" → "cfare". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ë/g, "e")
    .replace(/ç/g, "c")
    .trim();
}

/**
 * Rreshtat që përputhen me çdo fjalë të kërkimit (në emër ose në fjalët e afërta), me ata që e kanë fjalën
 * në fillim të emrit të parët. Kërkimi bosh s'kthen asgjë: atëherë shfaqet lista e plotë.
 */
export function searchSettings<T extends Searchable>(rows: T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = rows
    .map((row, index) => {
      const label = fold(row.label);
      const haystack = `${label} ${fold(row.keywords ?? "")}`;
      if (!words.every((w) => haystack.includes(w))) return null;
      const startsLabel = label.split(/\s+/).some((part) => part.startsWith(words[0]));
      return { row, index, score: startsLabel ? 0 : label.includes(words[0]) ? 1 : 2 };
    })
    .filter((x): x is { row: T; index: number; score: number } => x !== null);
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((x) => x.row);
}
