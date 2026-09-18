import { supabase } from "@/lib/supabase/client";

/**
 * Familja: bebi i përbashkët me prindin tjetër.
 *
 * Modeli është një "shtëpi" e identifikuar nga pronari — ai që e krijoi
 * bebin. Anëtari nuk mban kopje të vetën: lexon dhe shkruan te të dhënat E
 * PRONARIT. Prandaj ekziston `resolveDataOwnerId()`: çdo sinkronizim duhet
 * ta përdorë atë, jo id-në e llogarisë, përndryshe secili prind do të
 * shkruante në një histori të vetën dhe do të dukej sikur nuk ndodh asgjë.
 */

export type HouseholdMember = {
  memberId: string;
  joinedAt: string;
};

export type HouseholdState = {
  /** Kujt i përkasin të dhënat që po sheh ky telefon. */
  ownerId: string;
  /** A jam unë pronari, apo i ftuar te dikush tjetër. */
  isOwner: boolean;
  /** Anëtarët e ftuar (bosh nëse jam vetë anëtar). */
  members: HouseholdMember[];
};

/** Kujtesa brenda sesionit; pastrohet kur ndryshon llogaria. */
let cachedOwnerId: { userId: string; ownerId: string } | null = null;

export function clearHouseholdCache(): void {
  cachedOwnerId = null;
}

/**
 * Id-ja e pronarit të të dhënave për përdoruesin aktual. Kthen id-në e
 * vetë përdoruesit nëse s'është anëtar askund, ose nëse s'ka rrjet — që
 * app-i të punojë njësoj si më parë kur diçka dështon.
 */
export async function resolveDataOwnerId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return null;

  if (cachedOwnerId?.userId === userId) return cachedOwnerId.ownerId;

  try {
    const { data: row, error } = await supabase
      .from("baby_household_members")
      .select("owner_id")
      .eq("member_id", userId)
      .maybeSingle();

    const ownerId = !error && row?.owner_id ? (row.owner_id as string) : userId;
    cachedOwnerId = { userId, ownerId };
    return ownerId;
  } catch {
    // Pa lidhje: puno me të dhënat e veta, siç ishte më parë.
    return userId;
  }
}

export async function fetchHousehold(): Promise<HouseholdState | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return null;

  const ownerId = (await resolveDataOwnerId()) ?? userId;
  const isOwner = ownerId === userId;

  if (!isOwner) return { ownerId, isOwner, members: [] };

  const { data: rows } = await supabase
    .from("baby_household_members")
    .select("member_id, created_at")
    .eq("owner_id", userId)
    .order("created_at");

  return {
    ownerId,
    isOwner,
    members: (rows ?? []).map((r: any) => ({ memberId: r.member_id, joinedAt: r.created_at })),
  };
}

/** Kod ftese, i vlefshëm 7 ditë. Vetëm pronari mund ta krijojë. */
export async function createInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc("create_household_invite");
  if (error) throw new Error(error.message);
  return data as string;
}

/** Pranon ftesën. Pas kësaj, telefoni fillon të lexojë të dhënat e pronarit. */
export async function joinHousehold(code: string): Promise<void> {
  const { error } = await supabase.rpc("join_household", { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message);
  clearHouseholdCache();
}

/** Anëtari largohet vetë. Të dhënat mbeten te pronari — ai nuk humb asgjë. */
export async function leaveHousehold(memberId: string, ownerId: string): Promise<void> {
  const { error } = await supabase
    .from("baby_household_members")
    .delete()
    .eq("owner_id", ownerId)
    .eq("member_id", memberId);
  if (error) throw new Error(error.message);
  clearHouseholdCache();
}
