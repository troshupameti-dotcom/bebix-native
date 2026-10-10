/**
 * Prindërit si ekip: kush bëri çfarë sot, fjalia e "lavdërimit" dhe nata
 * e radhës. Funksione të pastra; leximet nga serveri janë te household.ts.
 */

export type HouseholdRole = "parent" | "viewer";
export type MemberRelation = "mom" | "dad" | "guardian" | "grandparent" | "family";

export type HouseholdPerson = {
  userId: string;
  role: HouseholdRole;
  displayName: string | null;
  relation: MemberRelation | null;
  isOwner: boolean;
  isMe: boolean;
};

export type SummaryRow = { memberId: string; kind: "feeding" | "sleep" | "diaper"; n: number };

export type MemberDay = { userId: string; feedings: number; diapers: number; sleeps: number };

/** Numrat e sotëm për çdo prind (edhe ai pa shënime del me zero). */
export function memberDays(people: HouseholdPerson[], rows: SummaryRow[]): MemberDay[] {
  return people
    .filter((p) => p.role === "parent")
    .map((p) => {
      const mine = rows.filter((r) => r.memberId === p.userId);
      const n = (kind: SummaryRow["kind"]) => mine.filter((r) => r.kind === kind).reduce((s, r) => s + r.n, 0);
      return { userId: p.userId, feedings: n("feeding"), diapers: n("diaper"), sleeps: n("sleep") };
    });
}

export type Shoutout = { userId: string; kind: "diapers" | "feedings"; n: number };

/** Sa duhet që një ditë të meritojë lavdërim (pak = s'ka lajm). */
export const SHOUTOUT_MIN = 3;

/**
 * Lavdërimi i ditës: kush ndërroi më shumë pelena (ose, pa pelena, ushqeu më
 * shumë). Vetëm kur ka të paktën dy prindër — s'ka kuptim të lavdërosh veten.
 */
export function shoutout(days: MemberDay[]): Shoutout | null {
  if (days.length < 2) return null;
  const top = (pick: (d: MemberDay) => number) => [...days].sort((a, b) => pick(b) - pick(a))[0];
  const byDiapers = top((d) => d.diapers);
  if (byDiapers.diapers >= SHOUTOUT_MIN) return { userId: byDiapers.userId, kind: "diapers", n: byDiapers.diapers };
  const byFeedings = top((d) => d.feedings);
  if (byFeedings.feedings >= SHOUTOUT_MIN) return { userId: byFeedings.userId, kind: "feedings", n: byFeedings.feedings };
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "Sonte": data e mbrëmjes. Para orës 07:00 jemi ende te nata që nisi dje. */
export function currentNightKey(now: Date = new Date()): string {
  return dateKey(now.getHours() < 7 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now);
}

/** Mesnata lokale → tani+1 orë: dritarja e "sot" për përmbledhjen. */
export function todayRange(now: Date = new Date()): { from: string; to: string } {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: midnight.toISOString(), to: new Date(now.getTime() + 3600_000).toISOString() };
}

export type LabelKey = "rel_mom" | "rel_dad" | "rel_grandparent" | "rel_guardian" | "rel_family" | "team_partner";

/** Si thirret dikush në ekran: emri i vet, ose lidhja ("Mami"), ose "Partneri". */
export function personLabel(p: Pick<HouseholdPerson, "displayName" | "relation" | "role">, t: (k: LabelKey) => string): string {
  const name = p.displayName?.trim();
  if (name) return name;
  if (p.relation === "mom") return t("rel_mom");
  if (p.relation === "dad") return t("rel_dad");
  if (p.relation === "grandparent" || p.role === "viewer") return t("rel_grandparent");
  if (p.relation === "guardian") return t("rel_guardian");
  if (p.relation === "family") return t("rel_family");
  return t("team_partner");
}

/** Lidhja e profilit lokal (Mami/Babi/Kujdestar) → lidhja në familje. */
export function relationFromProfile(relation: string | null | undefined, role: HouseholdRole): MemberRelation | null {
  if (relation === "mom" || relation === "dad" || relation === "guardian") return relation;
  return role === "viewer" ? "grandparent" : null;
}
