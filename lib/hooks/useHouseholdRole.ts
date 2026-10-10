import { useEffect, useState } from "react";
import { resolveMyRole } from "@/lib/baby/household";
import type { HouseholdRole } from "@/lib/baby/team";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";

/**
 * Roli im në familje ("parent" ose "viewer" për gjyshërit). Deri sa të dihet,
 * dhe pa rrjet, "parent" — app-i sillet si më parë.
 */
export function useHouseholdRole(): HouseholdRole {
  const userId = useCurrentUserId();
  const [role, setRole] = useState<{ userId: string | null; role: HouseholdRole }>({ userId: null, role: "parent" });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void resolveMyRole().then((r) => alive && setRole({ userId, role: r }));
    return () => {
      alive = false;
    };
  }, [userId]);

  return role.userId === userId ? role.role : "parent";
}
