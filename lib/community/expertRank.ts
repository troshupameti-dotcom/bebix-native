import type { Stage } from "@/lib/age/engine";
import { specialtyRank } from "@/lib/age/stageConfig";

/**
 * Ekspertët sipas fazës së fëmijës aktiv: specialitetet e fazës në krye (p.sh. për 3–12 vjeç psikologu dhe logopedi),
 * të tjerët pas tyre. Asnjë s'fshihet; brenda të njëjtit specialitet mbetet radha që vjen nga serveri (vlerësimi).
 */
export function rankExperts<T extends { specialty?: string | null }>(experts: T[], stage: Stage | null | undefined): T[] {
  return experts
    .map((e, i) => ({ e, i, r: specialtyRank(stage, e.specialty ?? null) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}
