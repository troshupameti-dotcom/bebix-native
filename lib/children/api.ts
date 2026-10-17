import { supabase } from "@/lib/supabase/client";

/** Një fëmijë i familjes, si e kthen `my_children()`. */
export type Child = {
  id: string;
  ownerId: string;
  name: string | null;
  /** "YYYY-MM-DD" */
  birthDate: string | null;
  dueDate: string | null;
  photoPath: string | null;
  isFree: boolean;
  /** Fëmijë shtesë pa Premium: s'zgjidhet dot si aktiv; të dhënat mbeten. */
  isLocked: boolean;
  /** Aktiv sipas serverit (për këtë person). */
  isActive: boolean;
  createdAt: string;
};

export type ChildErrorCode =
  | "PREMIUM_REQUIRED"
  | "FREE_CHANGE_COOLDOWN"
  | "NOT_ALLOWED"
  | "DATE_REQUIRED"
  | "INVALID_DATE"
  /** Migrimi i fëmijëve s'është aplikuar ende te serveri: app-i punon si më parë. */
  | "UNAVAILABLE"
  | "UNKNOWN";

export class ChildError extends Error {
  constructor(public code: ChildErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ChildError";
  }
}

const KNOWN: ChildErrorCode[] = ["PREMIUM_REQUIRED", "FREE_CHANGE_COOLDOWN", "NOT_ALLOWED", "DATE_REQUIRED", "INVALID_DATE"];

export function toChildError(error: { code?: string; message?: string } | null | undefined): ChildError {
  const message = error?.message ?? "";
  const known = KNOWN.find((k) => message.includes(k));
  if (known) return new ChildError(known, message);
  // Funksioni ose tabela s'ekziston (PostgREST / Postgres).
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42P01" || error?.code === "PGRST205") {
    return new ChildError("UNAVAILABLE", message);
  }
  return new ChildError("UNKNOWN", message);
}

type ChildRow = {
  id: string;
  owner_id: string;
  name: string | null;
  birth_date: string | null;
  due_date: string | null;
  photo_path: string | null;
  is_free: boolean;
  is_locked: boolean;
  is_active: boolean;
  created_at: string;
};

export function childFromRow(r: ChildRow): Child {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    birthDate: r.birth_date,
    dueDate: r.due_date,
    photoPath: r.photo_path,
    isFree: !!r.is_free,
    isLocked: !!r.is_locked,
    isActive: !!r.is_active,
    createdAt: r.created_at,
  };
}

export async function fetchMyChildren(): Promise<{ children: Child[]; isPremium: boolean }> {
  const [kids, plan] = await Promise.all([supabase.rpc("my_children"), supabase.rpc("my_plan")]);
  if (kids.error) throw toChildError(kids.error);
  const planRow = Array.isArray(plan.data) ? plan.data[0] : plan.data;
  return {
    children: ((kids.data ?? []) as ChildRow[]).map(childFromRow),
    isPremium: !plan.error && !!(planRow as { is_premium?: boolean } | null)?.is_premium,
  };
}

/** Shton një fëmijë (datëlindja ose data e pritur). I dyti pa Premium: ChildError("PREMIUM_REQUIRED"). */
export async function addChildRemote(input: { name: string; birthDate: string | null; dueDate?: string | null }): Promise<string> {
  const { data, error } = await supabase.rpc("add_child", {
    p_name: input.name,
    p_birth_date: input.birthDate,
    p_due_date: input.dueDate ?? null,
  });
  if (error) throw toChildError(error);
  return data as string;
}

export async function setActiveChildRemote(childId: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_child", { p_child: childId });
  if (error) throw toChildError(error);
}

/** Ndërron fëmijën falas. Pa Premium: një herë në 30 ditë (ChildError("FREE_CHANGE_COOLDOWN")). */
export async function setFreeChildRemote(childId: string): Promise<void> {
  const { error } = await supabase.rpc("set_free_child", { p_child: childId });
  if (error) throw toChildError(error);
}
