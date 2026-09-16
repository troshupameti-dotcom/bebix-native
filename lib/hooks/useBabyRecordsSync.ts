import { useEffect, useRef } from "react";
import { useAppState } from "@/lib/state/AppStateContext";
import { syncBabyRecords } from "@/lib/baby/babyRecordsSync";

/**
 * Nis sync-un e historikut të baby-t me Supabase një herë për session, pasi
 * state-i është ngarkuar nga AsyncStorage dhe vetëm për përdorues të kyçur.
 *
 * Nuk varet nga `state.baby` në listën e varësive me qëllim: ajo ndryshon në
 * çdo shkrim të prindit, dhe do e nisë sync-un pa fund. State-i lexohet nga
 * një ref, kështu që sync-u e merr gjendjen e momentit pa e rinisur veten.
 */
export function useBabyRecordsSync(isAuthenticated: boolean) {
  const { state, hydrated, applyBabyRecordsPatch } = useAppState();

  const latestBaby = useRef(state.baby);
  latestBaby.current = state.baby;

  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Dalje nga llogaria: lejo sync-un për përdoruesin e radhës.
      hasRun.current = false;
      return;
    }
    if (!hydrated || hasRun.current) return;
    hasRun.current = true;

    syncBabyRecords(latestBaby.current)
      .then((patch) => {
        if (patch) applyBabyRecordsPatch(patch);
      })
      .catch((e) => {
        // Dështimi i sync-ut s'duhet t'i prishë asgjë prindit: të dhënat janë
        // të ruajtura lokalisht dhe riprovohet në hapjen e radhës.
        console.log("Sync-u i baby_records dështoi:", e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, hydrated]);
}
