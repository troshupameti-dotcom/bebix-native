import { currentNightKey, memberDays, personLabel, relationFromProfile, shoutout, todayRange, type HouseholdPerson } from "@/lib/baby/team";

const person = (userId: string, over: Partial<HouseholdPerson> = {}): HouseholdPerson => ({
  userId, role: "parent", displayName: null, relation: null, isOwner: false, isMe: false, ...over,
});
const t = (k: string) => ({ rel_mom: "Mami", rel_dad: "Babi", rel_grandparent: "Gjyshja", rel_guardian: "Kujdestari", rel_family: "Familjari", team_partner: "Partneri" })[k] ?? k;

describe("ekipi sot", () => {
  const mom = person("m", { relation: "mom", isMe: true, isOwner: true });
  const dad = person("d", { relation: "dad" });
  const gma = person("g", { role: "viewer" });

  it("numrat për çdo prind (shikuesit s'numërohen)", () => {
    const days = memberDays([mom, dad, gma], [
      { memberId: "d", kind: "diaper", n: 6 },
      { memberId: "d", kind: "feeding", n: 2 },
      { memberId: "m", kind: "feeding", n: 5 },
      { memberId: "m", kind: "sleep", n: 1 },
    ]);
    expect(days).toEqual([
      { userId: "m", feedings: 5, diapers: 0, sleeps: 1 },
      { userId: "d", feedings: 2, diapers: 6, sleeps: 0 },
    ]);
  });

  it("lavdërimi: më shumë pelena; pa pelena, më shumë ushqyerje; pak = asgjë", () => {
    expect(shoutout([{ userId: "m", feedings: 5, diapers: 1, sleeps: 0 }, { userId: "d", feedings: 2, diapers: 6, sleeps: 0 }])).toEqual({ userId: "d", kind: "diapers", n: 6 });
    expect(shoutout([{ userId: "m", feedings: 5, diapers: 1, sleeps: 0 }, { userId: "d", feedings: 2, diapers: 2, sleeps: 0 }])).toEqual({ userId: "m", kind: "feedings", n: 5 });
    expect(shoutout([{ userId: "m", feedings: 1, diapers: 1, sleeps: 0 }, { userId: "d", feedings: 2, diapers: 2, sleeps: 0 }])).toBeNull();
    // Vetëm një prind: s'ka kë të lavdërojë
    expect(shoutout([{ userId: "m", feedings: 9, diapers: 9, sleeps: 0 }])).toBeNull();
  });

  it("emri: i vetë personit, ose lidhja, ose 'Partneri'", () => {
    expect(personLabel({ ...dad, displayName: " Arben " }, t)).toBe("Arben");
    expect(personLabel(dad, t)).toBe("Babi");
    expect(personLabel(mom, t)).toBe("Mami");
    expect(personLabel(gma, t)).toBe("Gjyshja");
    expect(personLabel(person("x"), t)).toBe("Partneri");
  });

  it("lidhja nga profili; shikuesi pa lidhje = gjysh/gjyshe", () => {
    expect(relationFromProfile("dad", "parent")).toBe("dad");
    expect(relationFromProfile(null, "parent")).toBeNull();
    expect(relationFromProfile(null, "viewer")).toBe("grandparent");
  });

  it("'sonte': para orës 07:00 është ende nata e djeshme", () => {
    expect(currentNightKey(new Date(2026, 9, 10, 21))).toBe("2026-10-10");
    expect(currentNightKey(new Date(2026, 9, 11, 3))).toBe("2026-10-10");
    expect(currentNightKey(new Date(2026, 9, 11, 7))).toBe("2026-10-11");
  });

  it("dritarja e sotme nis në mesnatën lokale", () => {
    const r = todayRange(new Date(2026, 9, 10, 15));
    expect(r.from).toBe(new Date(2026, 9, 10).toISOString());
    expect(new Date(r.to).getTime()).toBe(new Date(2026, 9, 10, 16).getTime());
  });
});
