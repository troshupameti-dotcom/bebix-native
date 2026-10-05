import { supabase } from "@/lib/supabase/client";
import { FALLBACK_SPECIALTIES, type Specialty } from "@/lib/community/specialtyList";

// Pjesa pa rrjet (lista rezervë dhe emrat) jeton te `specialtyList.ts`; këtu rishfaqet që ekranet ta importojnë nga një vend.
export { FALLBACK_SPECIALTIES, specialtyEmoji, specialtyLabel, type Specialty } from "@/lib/community/specialtyList";

export type SpecialtyList = {
  list: Specialty[];
  /** Tabela ekziston në bazë (migrimi është aplikuar): atëherë edhe filtri sipas repartit në rrjedhë funksionon. */
  fromDb: boolean;
};

let cached: SpecialtyList | null = null;
// Një kërkesë e vetme edhe kur njëzet postime e kërkojnë listën njëkohësisht.
let inflight: Promise<SpecialtyList> | null = null;

/** Repartet nga baza (të ruajtura sa hapet app-i); rezerva kur tabela mungon. */
export function fetchSpecialties(force = false): Promise<SpecialtyList> {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("community_specialties")
        .select("key,label,label_en,emoji,sort_order")
        .order("sort_order")
        .order("label");
      if (error || !data || data.length === 0) throw error ?? new Error("empty");
      cached = {
        fromDb: true,
        list: data.map((r: { key: string; label: string; label_en: string; emoji: string }) => ({
          key: r.key,
          label: r.label,
          labelEn: r.label_en,
          emoji: r.emoji,
        })),
      };
    } catch {
      cached = { list: FALLBACK_SPECIALTIES, fromDb: false };
    }
    return cached;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
