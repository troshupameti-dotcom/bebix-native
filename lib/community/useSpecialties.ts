import { useEffect, useState } from "react";
import { FALLBACK_SPECIALTIES, fetchSpecialties, type SpecialtyList } from "@/lib/community/specialties";

/** Repartet për ekranin: nis me listën rezervë (pa pritje) dhe kalon te ajo e bazës sapo vjen. */
export function useSpecialties(): SpecialtyList {
  const [value, setValue] = useState<SpecialtyList>({ list: FALLBACK_SPECIALTIES, fromDb: false });
  useEffect(() => {
    let alive = true;
    void fetchSpecialties().then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return value;
}
