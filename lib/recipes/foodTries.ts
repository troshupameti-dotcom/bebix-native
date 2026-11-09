import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { fetchShareCare, resolveDataOwnerId, resolveDataOwnerIdStrict, resolveMyRole } from "@/lib/baby/household";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { useHouseholdRole } from "@/lib/hooks/useHouseholdRole";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { FOOD_LIKINGS, REACTION_SYMPTOMS, type FoodLiking, type FoodTry, type ReactionSymptom } from "@/lib/recipes/types";

/**
 * Provat e ushqimeve të fëmijës aktiv ("E provoi 5 herë", 😋/🙂/🙅, "pati reagim?"), si shënimet e bebit: ruhen
 * menjëherë në telefon (punojnë pa rrjet) dhe dërgohen te `food_tries` te familja, që t'i shohë edhe prindi tjetër.
 * Çdo fëmijë ka listën e vet. Gjyshërit vetëm lexojnë, dhe vetëm kur prindërit ndajnë kujdesin (RLS e bazës).
 * Ndryshimet e padërguara (`dirty`) provohen sërish te hapja e radhës; kur vjen lista nga serveri, fiton më e reja.
 */
type Stored = FoodTry & { dirty?: boolean };
type Data = Record<string, Stored>;

const storageKey = (scope: string) => `bebix_food_tries_v1:${scope}`;
const PULL_EVERY_MS = 60_000;

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

async function load(nextScope: string, childId: string | null) {
  if (scope === nextScope && ready) return;
  scope = nextScope;
  childOf = childId;
  ready = false;
  lastPull = 0;
  // Provat e një fëmije tjetër (ose të një llogarie tjetër) s'shfaqen këtu.
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
  // Prova e shënuar gjatë leximit nga telefoni s'humbet.
  data = { ...saved, ...data };
  ready = true;
  emit();
}

type Row = {
  id: string;
  food_key: string;
  tried_at: string;
  liking: string | null;
  reaction: boolean | null;
  symptoms: string[] | null;
  note: string | null;
  recipe_slug: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function fromRow(r: Row): FoodTry {
  return {
    id: r.id,
    foodKey: r.food_key,
    triedAt: r.tried_at,
    liking: (FOOD_LIKINGS as readonly string[]).includes(r.liking ?? "") ? (r.liking as FoodLiking) : null,
    reaction: !!r.reaction,
    symptoms: (r.symptoms ?? []).filter((s): s is ReactionSymptom => (REACTION_SYMPTOMS as readonly string[]).includes(s)),
    note: r.note ?? "",
    recipeSlug: r.recipe_slug,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

const toRow = (owner: string, childId: string | null, t: FoodTry) => ({
  user_id: owner,
  id: t.id,
  baby_id: childId,
  food_key: t.foodKey,
  tried_at: t.triedAt,
  liking: t.liking,
  reaction: t.reaction,
  symptoms: t.symptoms,
  note: t.note,
  recipe_slug: t.recipeSlug,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
  deleted_at: t.deletedAt,
});

function markClean(id: string, updatedAt: string) {
  const entry = data[id];
  if (!entry || entry.updatedAt !== updatedAt || !entry.dirty) return;
  set({ ...data, [id]: { ...entry, dirty: false } });
}

/** Dërgon provat e padërguara dhe merr ato të familjes. Gabimet heshten: provohet herën tjetër. */
async function sync(force = false) {
  if (!force && Date.now() - lastPull < PULL_EVERY_MS) return;
  const mine = scope;
  const childId = childOf;
  if (!mine || mine.startsWith("guest")) return;
  let owner: string | null;
  try {
    owner = await resolveDataOwnerIdStrict();
  } catch {
    return; // Pa rrjet s'dihet i sigurt kujt familjeje i përket prova: pritet.
  }
  if (!owner || scope !== mine) return;
  lastPull = Date.now();
  const viewer = (await resolveMyRole()) === "viewer";
  if (!viewer) {
    const pending = Object.values(data).filter((t) => t.dirty);
    if (pending.length) {
      const { error } = await supabase.from("food_tries").upsert(
        pending.map(({ dirty: _dirty, ...t }) => toRow(owner, childId, t)),
        { onConflict: "user_id,id" }
      );
      if (!error) pending.forEach((t) => markClean(t.id, t.updatedAt));
    }
  }
  let query = supabase.from("food_tries").select("*").eq("user_id", owner);
  if (childId) query = query.eq("baby_id", childId);
  const { data: rows, error } = await query.order("tried_at", { ascending: false }).range(0, 1999);
  if (scope !== mine || error || !Array.isArray(rows)) return;
  const next: Data = viewer ? {} : { ...data };
  for (const r of rows as Row[]) {
    const remote = fromRow(r);
    const local = next[remote.id];
    if (!local || (!local.dirty && remote.updatedAt >= local.updatedAt) || remote.updatedAt > local.updatedAt) next[remote.id] = remote;
  }
  set(next);
}

function ensure(nextScope: string, childId: string | null) {
  if (!loading || scope !== nextScope) {
    loading = load(nextScope, childId).then(() => {
      loading = null;
    });
  }
  return loading ?? Promise.resolve();
}

const newId = () => `ft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type NewFoodTry = { foodKey: string; triedAt?: string; liking?: FoodLiking | null; reaction?: boolean; symptoms?: ReactionSymptom[]; note?: string; recipeSlug?: string | null };

/** Shënon një provë dhe kthen id-në e saj. */
export function addFoodTry(input: NewFoodTry): string {
  const at = new Date().toISOString();
  const entry: Stored = {
    id: newId(),
    foodKey: input.foodKey,
    triedAt: input.triedAt ?? at,
    liking: input.liking ?? null,
    reaction: !!input.reaction,
    symptoms: input.reaction ? (input.symptoms ?? []) : [],
    note: input.note ?? "",
    recipeSlug: input.recipeSlug ?? null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    dirty: true,
  };
  set({ ...data, [entry.id]: entry });
  void sync(true).catch(() => {});
  return entry.id;
}

export function updateFoodTry(id: string, patch: Partial<Pick<FoodTry, "liking" | "reaction" | "symptoms" | "note" | "triedAt">>) {
  const entry = data[id];
  if (!entry) return;
  // Ora e re duhet të jetë pas së vjetrës, edhe kur dy ndryshime ndodhin në të njëjtën milisekondë.
  const now = new Date().toISOString();
  const updatedAt = now > entry.updatedAt ? now : new Date(new Date(entry.updatedAt).getTime() + 1).toISOString();
  set({ ...data, [id]: { ...entry, ...patch, updatedAt, dirty: true } });
  void sync(true).catch(() => {});
}

/** Fshirje e butë, që të arrijë edhe te telefoni i prindit tjetër. */
export function removeFoodTry(id: string) {
  const entry = data[id];
  if (!entry) return;
  const at = new Date().toISOString();
  set({ ...data, [id]: { ...entry, deletedAt: at, updatedAt: at > entry.updatedAt ? at : entry.updatedAt, dirty: true } });
  void sync(true).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Provat e fëmijës aktiv, më e reja e para (pa të fshirat). */
export function useFoodTries(): { tries: FoodTry[]; ready: boolean } {
  const userId = useCurrentUserId();
  const { childId } = useActiveChild();
  const snapshot = useSyncExternalStore(subscribe, () => data, () => data);
  const nextScope = `${userId ?? "guest"}:${childId ?? "main"}`;

  useEffect(() => {
    void ensure(nextScope, childId)
      .then(() => sync())
      .catch(() => {});
  }, [nextScope, childId]);

  const tries = useMemo(
    () =>
      Object.values(snapshot)
        .filter((t) => !t.deletedAt)
        .map(({ dirty: _dirty, ...t }) => t)
        .sort((a, b) => (a.triedAt < b.triedAt ? 1 : -1)),
    [snapshot]
  );
  return { tries, ready: ready && scope === nextScope };
}

// ---- Kush i sheh provat ----------------------------------------------------------------------------------

let shareCareCache: { owner: string; value: boolean } | null = null;

/**
 * Prindërit i shohin dhe i shënojnë provat. Gjyshërit (viewer) shohin recetat dhe udhëzuesin e ushqimeve, por provat
 * dhe reagimet vetëm kur prindërit ndezin "Gjyshërit shohin edhe kujdesin" (Më shumë → Familja); s'shënojnë kurrë.
 */
export function useCareAccess(): { canSee: boolean; canWrite: boolean } {
  const role = useHouseholdRole();
  const [share, setShare] = useState<boolean>(shareCareCache?.value ?? false);

  useEffect(() => {
    if (role !== "viewer") return;
    let alive = true;
    void resolveDataOwnerId()
      .then((owner) => (owner ? fetchShareCare(owner).then((value) => ({ owner, value })) : null))
      .then((res) => {
        if (!res) return;
        shareCareCache = res;
        if (alive) setShare(res.value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [role]);

  if (role !== "viewer") return { canSee: true, canWrite: true };
  return { canSee: share, canWrite: false };
}

export function __resetFoodTriesForTests() {
  scope = null;
  childOf = null;
  data = {};
  ready = false;
  lastPull = 0;
  loading = null;
  shareCareCache = null;
}
