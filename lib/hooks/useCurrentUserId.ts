import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { setAnalyticsUser } from "@/lib/analytics/posthog";
import { clearHouseholdCache } from "@/lib/baby/household";

/**
 * Id-ja e përdoruesit të kyçur, e përbashkët për gjithë app-in. Lexohet nga
 * sesioni lokal (pa rrjet) dhe ndjek ndryshimet e sesionit, prandaj mund të
 * përdoret në çdo kartelë të një liste pa shumëfishuar kërkesat.
 */
let currentId: string | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(id: string | null) {
  if (id === currentId) return;
  currentId = id;
  // I vetmi vend ku ndryshon identiteti i perdoruesit — analitika dhe
  // kujtesa e familjes e ndjekin ketu.
  setAnalyticsUser(id);
  clearHouseholdCache();
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => set(data.session?.user.id ?? null));
  supabase.auth.onAuthStateChange((_event, session) => set(session?.user.id ?? null));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCurrentUserId(): string | null {
  return useSyncExternalStore(subscribe, () => currentId, () => currentId);
}
