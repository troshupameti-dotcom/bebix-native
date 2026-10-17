/**
 * Komuniteti sipas moshës (faza 3): feed-i hapet te grupi i moshës së fëmijës aktiv, me skedën "Të gjitha"; ekspertët
 * renditen sipas fazës, pa u fshehur asnjë.
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Community from "@/app/(main)/community/index";
import { rankExperts } from "@/lib/community/expertRank";

const tab = (root: ReactTestInstance, label: string) =>
  root.findAll((n) => n.props.accessibilityRole === "tab" && visibleText(n).includes(label))[0];
const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};
const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  d.setDate(d.getDate() - 1);
  return d.toISOString();
};

beforeEach(() => {
  const fake = fakeSupabase();
  fake.tables.community_groups = [
    { id: "g-age", name: "Fëmijët 3–5 vjeç", description: "", icon: "family", accent: "olive", member_count: 0, kind: "age", auto_key: "age:36-72" },
  ];
  fake.tables.community_feed = [];
  fake.tables.community_experts = [];
  fake.tables.community_topics = [];
  fake.tables.community_tips = [];
  fake.tables.community_group_members = [];
});

describe("feed-i sipas moshës", () => {
  it("fëmija 4 vjeç: 'Të gjitha' e para dhe e hapur, pastaj 'Për moshën'", async () => {
    await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyDob: monthsAgo(50) } }));
    const r = await renderScreen(<Community />);
    await settle();
    const texts = visibleText(r.root);
    expect(texts.indexOf("Të gjitha")).toBeLessThan(texts.indexOf("Për moshën"));
    expect(tab(r.root, "Të gjitha").props.accessibilityState).toEqual({ selected: true });
    // Te "Për moshën", pa postime ende: mesazh dhe rruga te të gjitha.
    await act(async () => { tab(r.root, "Për moshën").props.onPress(); });
    await settle();
    expect(visibleText(r.root)).toContain("Ende s'ka postime për këtë moshë");
    await act(async () => {
      r.root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).includes("Shiko të gjitha"))[0].props.onPress();
    });
    await settle();
    expect(tab(r.root, "Të gjitha").props.accessibilityState).toEqual({ selected: true });
  });

  it("pa datëlindje: si më parë ('Për ty'), pa skedën e moshës", async () => {
    const r = await renderScreen(<Community />);
    await settle();
    const texts = visibleText(r.root);
    expect(texts).toContain("Për ty");
    expect(texts).not.toContain("Për moshën");
  });

  it("13 vjeç (arkivi): pa feed moshe", async () => {
    await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyDob: monthsAgo(160) } }));
    const r = await renderScreen(<Community />);
    await settle();
    expect(visibleText(r.root)).not.toContain("Për moshën");
  });
});

describe("ekspertët sipas fazës", () => {
  const list = [
    { id: "1", specialty: "neonatologist" },
    { id: "2", specialty: "pediatrician" },
    { id: "3", specialty: "psychologist" },
    { id: "4", specialty: null },
    { id: "5", specialty: "speech_therapist" },
  ];
  it("3–12 vjeç: psikologu dhe logopedi në krye, asnjë s'fshihet", () => {
    expect(rankExperts(list, "child").map((e) => e.id)).toEqual(["3", "5", "2", "1", "4"]);
  });
  it("foshnja: pediatri dhe neonatologu në krye", () => {
    expect(rankExperts(list, "infant").map((e) => e.id)).toEqual(["2", "1", "3", "4", "5"]);
  });
  it("pa fëmijë: radha e serverit", () => {
    expect(rankExperts(list, null).map((e) => e.id)).toEqual(["1", "2", "3", "4", "5"]);
  });
});
