import { useEffect, useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { resolveDataOwnerIdStrict, resolveMyRole } from "@/lib/baby/household";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { addDays, isoDay, slotKey, weekStartOf, type PlanMap } from "@/lib/recipes/planner";
import { MEAL_TYPES, type MealType } from "@/lib/recipes/types";

/**
 * "Plani i javës" i fëmijës aktiv, si provat e ushqimeve: ruhet menjëherë në telefon (punon pa rrjet) dhe dërgohet te
 * `meal_plan_slots` te familja, që ta shohë edhe prindi tjetër dhe të mos humbasë kur ndërrohet telefoni. Gjyshërit
 * vetëm e lexojnë. Heqja e një vakti ruhet si vakt bosh, që të arrijë edhe te telefoni tjetër; fiton më i riu.
 */
type Slot = { day: string; meal: MealType; recipeSlug: string | null; updatedAt: string; dirty?: boolean };
type Data = Record<string, Slot>;

const storageKey = (scope: string) => `bebix_meal_plan_v1:${scope}`;
const PULL_EVERY_MS = 60_000;
/** Sa larg mbahet plani: 4 javë prapa (për t'u parë) dhe 6 përpara. */
const KEEP_BACK_DAYS = 28;
const PULL_AHEAD_DAYS = 42;

let scope: string | null = null;
let childOf: string | null = null;
let data: Data = {};
let ready = false;
let lastPull = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: Data) {
  data = next;
  emit();
  if (scope) void AsyncStorage.setItem(storageKey(scope), JSON.stringify(next)).catch(() => {});
}

/** Javët e vjetra s'mbahen në telefon (përveç atyre që s'janë dërguar ende). */
function prune(d: Data): Data {
  const oldest = addDays(weekStartOf(new Date()), -KEEP_BACK_DAYS);
  return Object.fromEntries(Object.entries(d).filter(([, s]) => s.dirty || s.day >= oldest));
}

async function load(nextScope: string, childId: string | null) {
  if (scope === nextScope && ready) return;
  scope = nextScope;
  childOf = childId;
  ready = false;
  lastPull = 0;
  data = {};
  emit();
  let saved: Data = {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(nextScope));
    if (raw) saved = JSON.parse(raw) as Data;
  } catch {
    saved = {};
  }
  if (scope !== nextScope) return;
  data = prune({ ...saved, ...data });
  ready = true;
  emit();
}

type Row = { plan_date: string; meal: string; recipe_slug: string | null; updated_at: string };

async function sync(force = false) {
  if (!force && Date.now() - lastPull < PULL_EVERY_MS) return;
  const mine = scope;
  const childId = childOf;
  if (!mine || mine.startsWith("guest")) return;
  let owner: string | null;
  try {
    owner = await resolveDataOwnerIdStrict();
  } catch {
    return; // Pa rrjet s'dihet i sigurt kujt familjeje i përket plani: pritet.
  }
  if (!owner || scope !== mine) return;
  lastPull = Date.now();
  const viewer = (await resolveMyRole()) === "viewer";
  if (!viewer) {
    const pending = Object.values(data).filter((s) => s.dirty);
    if (pending.length) {
      const { error } = await supabase.from("meal_plan_slots").upsert(
        pending.map((s) => ({ user_id: owner, baby_id: childId, plan_date: s.day, meal: s.meal, recipe_slug: s.recipeSlug, updated_at: s.updatedAt })),
        { onConflict: "user_id,baby_id,plan_date,meal" }
      );
      if (!error) pending.forEach((s) => markClean(slotKey(s.day, s.meal), s.updatedAt));
    }
  }
  const from = addDays(weekStartOf(new Date()), -KEEP_BACK_DAYS);
  let query = supabase
    .from("meal_plan_slots")
    .select("plan_date, meal, recipe_slug, updated_at")
    .eq("user_id", owner)
    .gte("plan_date", from)
    .lte("plan_date", addDays(isoDay(new Date()), PULL_AHEAD_DAYS));
  if (childId) query = query.eq("baby_id", childId);
  const { data: rows, error } = await query.order("plan_date", { ascending: true }).range(0, 999);
  if (scope !== mine || error || !Array.isArray(rows)) return;
  const next: Data = viewer ? {} : { ...data };
  for (const r of rows as Row[]) {
    if (!(MEAL_TYPES as readonly string[]).includes(r.meal)) continue;
    const key = slotKey(r.plan_date, r.meal as MealType);
    const remote: Slot = { day: r.plan_date, meal: r.meal as MealType, recipeSlug: r.recipe_slug, updatedAt: r.updated_at };
    const local = next[key];
    if (!local || (!local.dirty && remote.updatedAt >= local.updatedAt) || remote.updatedAt > local.updatedAt) next[key] = remote;
  }
  set(next);
}

function markClean(key: string, updatedAt: string) {
  const entry = data[key];
  if (!entry || entry.updatedAt !== updatedAt || !entry.dirty) return;
  set({ ...data, [key]: { ...entry, dirty: false } });
}

function ensure(nextScope: string, childId: string | null) {
  if (!loading || scope !== nextScope) {
    loading = load(nextScope, childId).then(() => {
      loading = null;
    });
  }
  return loading ?? Promise.resolve();
}

/** Vendos (ose heq, me null) receta te vaktet e dhëna, njëherësh (p.sh. "Plotëso javën për mua"). */
export function setPlanSlots(entries: { day: string; meal: MealType; recipeSlug: string | null }[]) {
  if (!entries.length) return;
  const next = { ...data };
  const now = new Date().toISOString();
  for (const e of entries) {
    const key = slotKey(e.day, e.meal);
    const prev = next[key];
    // Ora e re duhet të jetë pas së vjetrës, që telefoni tjetër ta marrë si më të renë.
    const updatedAt = !prev || now > prev.updatedAt ? now : new Date(new Date(prev.updatedAt).getTime() + 1).toISOString();
    next[key] = { day: e.day, meal: e.meal, recipeSlug: e.recipeSlug, updatedAt, dirty: true };
  }
  set(next);
  void sync(true).catch(() => {});
}

/** Nga një hartë vakt → recetë (p.sh. rezultati i `fillWeek`). */
export function applyPlan(assigned: PlanMap) {
  setPlanSlots(
    Object.entries(assigned).map(([key, recipeSlug]) => {
      const [day, meal] = key.split(":") as [string, MealType];
      return { day, meal, recipeSlug };
    })
  );
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Plani i fëmijës aktiv: vakti → receta. */
export function useMealPlan(): { plan: PlanMap; ready: boolean } {
  const userId = useCurrentUserId();
  const { childId } = useActiveChild();
  const snapshot = useSyncExternalStore(subscribe, () => data, () => data);
  const nextScope = `${userId ?? "guest"}:${childId ?? "main"}`;

  useEffect(() => {
    void ensure(nextScope, childId)
      .then(() => sync())
      .catch(() => {});
  }, [nextScope, childId]);

  const plan = useMemo(() => {
    const out: PlanMap = {};
    for (const [key, s] of Object.entries(snapshot)) if (s.recipeSlug) out[key] = s.recipeSlug;
    return out;
  }, [snapshot]);
  return { plan, ready: ready && scope === nextScope };
}

export function __resetMealPlanForTests() {
  scope = null;
  childOf = null;
  data = {};
  ready = false;
  lastPull = 0;
  loading = null;
}
