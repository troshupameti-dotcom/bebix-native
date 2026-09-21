/**
 * Mbrojtja e fushës `occurred_at`.
 *
 * Kolona në bazë është `timestamptz`, por disa fusha të regjistrimeve janë
 * tekst i lirë i shkruar nga prindi: te "Kronologjia" data shtypet me dorë,
 * dhe "5 Maj, 2024" nuk është timestamp. Postgres-i e refuzon — dhe refuzon
 * të GJITHË grumbullin, jo vetëm atë rresht. Pra një ngjarje e vetme e
 * shkruar me dorë i ndalte në heshtje të gjitha të dhënat e bebit nga
 * sinkronizimi, në çdo provë.
 *
 * `Date.parse` nuk përdoret i vetëm sepse është tepër tolerant: "5" do të
 * bëhej një vit, dhe një gabim shtypi do të kthehej në një datë të rreme.
 * Pranohet vetëm forma ISO, e cila është ajo që shkruan vetë app-i.
 *
 * Teksti origjinal nuk humbet: rri te `payload` i regjistrimit, dhe ekrani e
 * lexon prej andej. Kjo fushë shërben vetëm për renditje në server.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;

export function toTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !ISO_DATE.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}
