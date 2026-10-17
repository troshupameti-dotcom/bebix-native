import { useMemo } from "react";
import { useAppState } from "@/lib/state/AppStateContext";
import { useChildren } from "@/lib/children/store";
import { ageInMonths, getAgeGroupKey, getStage, type ChildAgeInput, type Stage } from "@/lib/age/engine";

export type ActiveChildAge = {
  /** Fëmija aktiv (data e lindjes nga profili i tij, data e pritur nga lista e fëmijëve). */
  child: ChildAgeInput;
  stage: Stage | null;
  months: number | null;
  ageGroupKey: string | null;
  /** id e fëmijës aktiv; null në mënyrën e vjetër (një bebi). */
  childId: string | null;
};

/** Faza dhe mosha e fëmijës aktiv: e vetmja hyrje për ekranet që ndryshojnë sipas moshës. */
export function useActiveChild(now?: Date): ActiveChildAge {
  const { state } = useAppState();
  const { mode, children, activeChildId } = useChildren();
  const babyDob = state.profile.babyDob;
  const time = now?.getTime();
  return useMemo(() => {
    const active = mode === "ready" ? children.find((c) => c.id === activeChildId) : undefined;
    const child: ChildAgeInput = { birthDate: babyDob ?? active?.birthDate ?? null, dueDate: active?.dueDate ?? null };
    const at = time != null ? new Date(time) : new Date();
    return {
      child,
      stage: getStage(child, at),
      months: ageInMonths(child.birthDate, at),
      ageGroupKey: getAgeGroupKey(child, at),
      childId: active?.id ?? null,
    };
  }, [mode, children, activeChildId, babyDob, time]);
}
