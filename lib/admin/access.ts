import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";

const known = new Map<string, boolean>();

/**
 * A është admin llogaria? Roli vjen nga tabela `admins` (e njëjta që përdor `is_admin()` te baza dhe paneli i
 * webit), kurrë nga vetë app-i. Edhe nëse dikush e hap ekranin, baza s'i jep asnjë të dhënë pa këtë rresht.
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const cached = known.get(userId);
  if (cached !== undefined) return cached;
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  // Gabimi (pa rrjet) s'ruhet: provohet përsëri herën tjetër.
  if (error) return false;
  known.set(userId, !!data);
  return !!data;
}

/** `null` derisa të dihet; pastaj true/false. */
export function useIsAdmin(): boolean | null {
  const userId = useCurrentUserId();
  const [result, setResult] = useState<{ userId: string; admin: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void checkIsAdmin(userId).then((admin) => alive && setResult({ userId, admin }));
    return () => {
      alive = false;
    };
  }, [userId]);
  if (!userId) return null;
  return result?.userId === userId ? result.admin : null;
}

export function __resetAdminCacheForTests(): void {
  known.clear();
}
