/* eslint-disable @typescript-eslint/no-require-imports -- fs/path në test, pa tipet e Node-it */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act } from "react-test-renderer";
import BabyHome from "@/app/(main)/baby/index";
import { READY_SEEN_KEY, ReadyForSolidsCard, showsReadyCard } from "@/components/recipes/ReadyForSolidsCard";
import { RECIPE_PHOTOS, FOOD_PHOTOS, PHOTO_CREDITS } from "@/content/recipes/photos";
import SEED from "@/content/recipes/sq.json";
import FOODS from "@/content/recipes/foods.json";
import type { Recipe } from "@/lib/recipes/types";

type Bytes = { toString(enc: string, start: number, end: number): string; readUInt16LE(at: number): number; readUInt32LE(at: number): number };
const fs = require("fs") as { statSync(f: string): { size: number }; readFileSync(f: string): Bytes };
const path = require("path") as { join(...p: string[]): string };
declare const __dirname: string;

const RECIPES = SEED as unknown as Recipe[];

describe("faqja kryesore pa recetat", () => {
  it("s'ka më “Ide për sot” as recetat: kanë skedën e vet “Ushqim”", async () => {
    fakeSupabase().tables.community_experts = [];
    const born = new Date();
    born.setMonth(born.getMonth() - 7);
    await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyName: "Ana", babyDob: born.toISOString() } }));
    const r = await renderScreen(<BabyHome />);
    const text = visibleText(r.root).join(" | ");
    expect(text).not.toMatch(/Ide për sot|Të gjitha recetat|Receta e ditës/);
  });
});

describe("gati për ushqimet e para? (te skeda Ushqim)", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(READY_SEEN_KEY);
  });

  it("del vetëm në 4–5 muaj", () => {
    expect([null, 2, 3, 4, 5, 6, 9].map(showsReadyCard)).toEqual([false, false, false, true, true, false, false]);
  });

  it("5 muaj: shenjat, dhe pas “E kuptova” s'del më", async () => {
    const r = await renderScreen(<ReadyForSolidsCard months={5} />);
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["Gati për ushqimet e para?", "Ulet me pak ndihmë"]));
    const ok = r.root.findAll((n) => typeof n.props.onPress === "function" && n.findAll((c) => c.props.children === "E kuptova").length > 0)[0];
    await act(async () => ok.props.onPress());
    expect(visibleText(r.root)).not.toContain("Gati për ushqimet e para?");
    expect(await AsyncStorage.getItem(READY_SEEN_KEY)).toBe("1");
    const again = await renderScreen(<ReadyForSolidsCard months={5} />);
    expect(visibleText(again.root)).not.toContain("Gati për ushqimet e para?");
  });

  it("7 muaj: s'del", async () => {
    const r = await renderScreen(<ReadyForSolidsCard months={7} />);
    expect(visibleText(r.root)).not.toContain("Gati për ushqimet e para?");
  });
});

describe("fotot reale", () => {
  it("çdo recetë dhe çdo ushqim ka foto, me autor, licencë të lirë dhe burim", () => {
    const missing = [
      ...RECIPES.filter((r) => !RECIPE_PHOTOS[r.slug]).map((r) => r.slug),
      ...(FOODS as { foodKey: string }[]).filter((f) => !FOOD_PHOTOS[f.foodKey]).map((f) => f.foodKey),
    ];
    expect(missing).toEqual([]);
    for (const [key, c] of Object.entries(PHOTO_CREDITS)) {
      expect([key, c.author.length > 0]).toEqual([key, true]);
      expect([key, /^(Pixabay License|CC0|Public domain|CC BY(-SA)? \d(\.\d)?( [a-z]{2,3})?)$/i.test(c.license)]).toEqual([key, true]);
      expect([key, /^https:\/\/(pixabay\.com|commons\.wikimedia\.org)\//.test(c.source)]).toEqual([key, true]);
    }
    expect(Object.keys(PHOTO_CREDITS)).toHaveLength(RECIPES.length + FOODS.length);
  });

  it("skedarët e fotove ekzistojnë dhe janë të lehtë; fotot e ushqimeve 640 px, që të mbushin kornizën pa u turbulluar", () => {
    const root = path.join(__dirname, "..", "assets", "recipes");
    for (const r of RECIPES) expect(fs.statSync(path.join(root, "photos", `${r.slug}.webp`)).size).toBeLessThan(200_000);
    for (const f of FOODS as { foodKey: string }[]) {
      const file = path.join(root, "foods", `${f.foodKey}.webp`);
      expect([f.foodKey, fs.statSync(file).size < 100_000]).toEqual([f.foodKey, true]);
      // WebP VP8/VP8L: gjerësia lexohet nga koka e skedarit.
      const b = fs.readFileSync(file);
      const kind = b.toString("ascii", 12, 16);
      const width = kind === "VP8 " ? b.readUInt16LE(26) & 0x3fff : kind === "VP8L" ? (b.readUInt32LE(21) & 0x3fff) + 1 : 0;
      expect([f.foodKey, width]).toEqual([f.foodKey, 640]);
    }
  });
});
