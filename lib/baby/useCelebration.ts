import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nextCelebration, type Celebration } from "@/lib/baby/celebrations";
import type { Moment } from "@/lib/state/babyTypes";

const SEEN_KEY = "bebix_celebrations_seen_v1";
const MAX_SEEN = 200;

/** Festimi për t'u treguar tani; secili del një herë në këtë telefon. */
export function useCelebration(babyDob: string | null, moments: Moment[]): { current: Celebration | null; dismiss: () => void } {
  // null = ende po lexohet (asgjë s'shfaqet para kësaj).
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => {
        const v = raw ? JSON.parse(raw) : [];
        setSeen(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
      })
      .catch(() => setSeen([]));
  }, []);

  const current = useMemo(() => (seen ? nextCelebration(babyDob, moments, new Set(seen)) : null), [babyDob, moments, seen]);

  const dismiss = useCallback(() => {
    if (!current) return;
    setSeen((prev) => {
      const next = [...(prev ?? []), current.id].slice(-MAX_SEEN);
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [current]);

  return { current, dismiss };
}
