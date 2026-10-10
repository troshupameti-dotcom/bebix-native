import { supabase } from "@/lib/supabase/client";
import type { HouseholdPerson, HouseholdRole, MemberRelation, SummaryRow } from "@/lib/baby/team";

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
  /** "parent" shkruan; "viewer" (gjyshërit) vetëm shikon. */
  role: HouseholdRole;
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
  cachedRole = null;
}

let cachedRole: { userId: string; role: HouseholdRole } | null = null;

/**
 * Roli im: "viewer" (vetëm shikim) vetëm kur jam ftuar si i tillë. Pa rrjet
 * ose pa migrimin në server: "parent", si deri tani.
 */
export async function resolveMyRole(): Promise<HouseholdRole> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return "parent";
  if (cachedRole?.userId === userId) return cachedRole.role;
  try {
    const { data: role, error } = await supabase.rpc("my_household_role");
    if (error) return "parent";
    const value: HouseholdRole = role === "viewer" ? "viewer" : "parent";
    cachedRole = { userId, role: value };
    return value;
  } catch {
    return "parent";
  }
}

/**
 * Id-ja e pronarit të të dhënave për përdoruesin aktual. Kthen id-në e
 * vetë përdoruesit nëse s'është anëtar askund, ose nëse s'ka rrjet — që
 * app-i të punojë njësoj si më parë kur diçka dështon.
 */
export async function resolveDataOwnerId(): Promise<string | null> {
  try {
    return await resolveDataOwnerIdStrict();
  } catch {
    // Pa lidhje: për leximet e thjeshta (p.sh. fotot e profilit) mjafton
    // llogaria vetë. Sync-u përdor versionin strikt dhe pret.
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }
}

/**
 * Pronari i të dhënave, ose GABIM kur s'mund të dihet (s'ka rrjet).
 *
 * Më parë, kur kërkesa dështonte, kthehej llogaria vetë — dhe ruhej në
 * kujtesë për gjithë sesionin. Për një prind të ftuar në familje, kjo do të
 * thoshte që sync-u i shkruante shënimet e bebit të përbashkët te llogaria e
 * VET (ku s'i sheh askush) dhe tërhiqte historikun e gabuar.
 */
export async function resolveDataOwnerIdStrict(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;

  if (cachedOwnerId?.userId === userId) return cachedOwnerId.ownerId;

  const { data: row, error } = await supabase
    .from("baby_household_members")
    .select("owner_id")
    .eq("member_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Familja nuk u lexua: ${error.message}`);

  const ownerId = row?.owner_id ? (row.owner_id as string) : userId;
  cachedOwnerId = { userId, ownerId };
  return ownerId;
}

export async function fetchHousehold(): Promise<HouseholdState | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return null;

  const ownerId = (await resolveDataOwnerId()) ?? userId;
  const isOwner = ownerId === userId;

  if (!isOwner) return { ownerId, isOwner, members: [] };

  const withRole = await supabase
    .from("baby_household_members")
    .select("member_id, created_at, role")
    .eq("owner_id", userId)
    .order("created_at");
  let rows: { member_id: string; created_at: string; role?: string }[] | null = withRole.data;
  // Pa migrimin e roleve: të gjithë janë prindër.
  if (withRole.error?.code === "42703") {
    rows = (await supabase.from("baby_household_members").select("member_id, created_at").eq("owner_id", userId).order("created_at")).data;
  }

  return {
    ownerId,
    isOwner,
    members: (rows ?? []).map((r: any) => ({ memberId: r.member_id, joinedAt: r.created_at, role: r.role === "viewer" ? "viewer" : "parent" })),
  };
}

/** Kod ftese, i vlefshëm 7 ditë. Vetëm pronari mund ta krijojë. "viewer" = gjyshërit (vetëm shikim). */
export async function createInviteCode(role: HouseholdRole = "parent"): Promise<string> {
  // Ftesa e prindit thirret pa argument: punon edhe para migrimit të roleve.
  const { data, error } = role === "parent" ? await supabase.rpc("create_household_invite") : await supabase.rpc("create_household_invite", { p_role: role });
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

// ---------------------------------------------------------------------
// Ekipi: njerëzit, përmbledhja e ditës, falënderimi, turnet e natës
// ---------------------------------------------------------------------

/** Njerëzit e familjes me emrat dhe rolet (supabase household_people()). */
export async function fetchPeople(): Promise<HouseholdPerson[]> {
  const { data, error } = await supabase.rpc("household_people");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    role: r.role === "viewer" ? "viewer" : "parent",
    displayName: r.display_name ?? null,
    relation: r.relation ?? null,
    isOwner: !!r.is_owner,
    isMe: !!r.is_me,
  }));
}

/** Emri, lidhja dhe gjuha ime — që njoftimet e partnerit të thonë "Mami", në gjuhën time. */
export async function saveMyMemberProfile(input: { displayName: string | null; relation: MemberRelation | null; lang: "sq" | "en" }): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  await supabase.from("household_member_profiles").upsert(
    {
      user_id: userId,
      display_name: input.displayName?.trim().slice(0, 40) || null,
      relation: input.relation,
      lang: input.lang,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function fetchDaySummary(from: string, to: string): Promise<SummaryRow[]> {
  const { data, error } = await supabase.rpc("household_day_summary", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ memberId: r.member_id, kind: r.kind, n: Number(r.n) || 0 }));
}

/** false = u arrit kufiri i ditës (3 falënderime për të njëjtin person). */
export async function sendThanks(to: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("send_household_thanks", { p_to: to });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function fetchNightShift(ownerId: string, night: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("household_night_shifts")
    .select("user_id")
    .eq("owner_id", ownerId)
    .eq("night", night)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.user_id as string | undefined) ?? null;
}

/** Cakton (ose heq, me null) kush zgjohet natën e dhënë; kujtesa i shkon atij në 20:30. */
export async function setNightShift(night: string, userId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_night_shift", { p_night: night, p_user: userId });
  if (error) throw new Error(error.message);
}

/** A i shohin gjyshërit edhe ushqimin, gjumin dhe pelenat. */
export async function fetchShareCare(ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("household_settings").select("share_care_with_viewers").eq("owner_id", ownerId).maybeSingle();
  return data?.share_care_with_viewers === true;
}

export async function setShareCare(ownerId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from("household_settings")
    .upsert({ owner_id: ownerId, share_care_with_viewers: value, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
}
