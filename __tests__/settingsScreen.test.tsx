/**
 * Cilësimet e reja: kërkimi (edhe pa "ë/ç", me fjalë të afërta), ndërrimet me një prekje (tema, nata, gjuha),
 * dhe llogaria e ndarë në fund (fshirja vetëm për dikë me llogari). Ekrani me provider-at e vërtetë.
 */
import { button, fakeSupabase, renderScreen, router, visibleText } from "./helpers/screen";
import { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { TextInput } from "react-native";
import MoreScreen from "@/app/(main)/more/index";
import { fold, searchSettings } from "@/lib/settings/search";
import { translations } from "@/lib/i18n/translations";

const sq = translations.sq;
const en = translations.en;

describe("kërkimi", () => {
  const rows = [
    { label: "Njoftimet", keywords: "kujtesa push" },
    { label: "Pamja", keywords: "tema errët dark" },
    { label: "Modaliteti i natës", keywords: "hënë kuqe" },
    { label: "Fshi llogarinë", keywords: "delete" },
  ];
  const labels = (q: string) => searchSettings(rows, q).map((r) => r.label);

  it("pa “ë” dhe “ç”, pa shkronja të mëdha", () => {
    expect(fold("Çfarë ka të RE")).toBe("cfare ka te re");
    expect(labels("nates")).toEqual(["Modaliteti i natës"]);
    expect(labels("LLOGARINE")).toEqual(["Fshi llogarinë"]);
  });

  it("me fjalë të afërta, në shqip dhe anglisht", () => {
    expect(labels("dark")).toEqual(["Pamja"]);
    expect(labels("erret")).toEqual(["Pamja"]);
    expect(labels("delete")).toEqual(["Fshi llogarinë"]);
  });

  it("çdo fjalë duhet të përputhet; kërkimi bosh s'kthen asgjë", () => {
    expect(labels("modaliteti nates")).toEqual(["Modaliteti i natës"]);
    expect(labels("modaliteti dyqan")).toEqual([]);
    expect(labels("   ")).toEqual([]);
  });

  it("emri që fillon me fjalën del i pari", () => {
    const list = [{ label: "Kujdesi për ty", keywords: "nëna" }, { label: "Njoftimet", keywords: "kujtesa" }, { label: "Kujtimet" }];
    expect(searchSettings(list, "kuj").map((r) => r.label)).toEqual(["Kujdesi për ty", "Kujtimet", "Njoftimet"]);
  });
});

const search = (r: ReactTestRenderer) => r.root.findAll((n) => n.type === TextInput)[0];
const type = (r: ReactTestRenderer, text: string) =>
  act(async () => {
    search(r).props.onChangeText(text);
  });
/** Pllaka me një prekje sipas emrit (accessibilityLabel "Pamja: E çelët"). */
const tile = (r: ReactTestRenderer, label: string): ReactTestInstance =>
  r.root.findAll((n) => typeof n.props.onPress === "function" && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith(`${label}: `))[0];

describe("ekrani i Cilësimeve", () => {
  it("titulli, rubrikat dhe llogaria në fund; pa llogari s'ka “Fshi llogarinë”", async () => {
    const r = await renderScreen(<MoreScreen />);
    const text = visibleText(r.root);
    expect(text[0]).toBe(sq.nav_more);
    for (const s of [sq.section_saved, sq.section_prefs, sq.section_help, sq.section_account]) {
      expect(text).toContain(s);
    }
    expect(text.indexOf(sq.logout)).toBeGreaterThan(text.indexOf(sq.legal));
    expect(text).not.toContain(sq.delete_account);
  });

  it("me llogari: “Fshi llogarinë” del në fund dhe të çon te faqja e fshirjes", async () => {
    fakeSupabase().session = { user: { id: "u1", email: "prindi@bebix.store", app_metadata: { provider: "email" } } };
    const r = await renderScreen(<MoreScreen />);
    expect(visibleText(r.root)).toContain("prindi@bebix.store");
    await act(async () => {
      button(r.root, sq.delete_account).props.onPress();
    });
    expect(router().push).toHaveBeenCalledWith("/more/delete-account");
  });

  it("kërkimi pa “ë”: “nate” gjen modalitetin e natës, me emrin e rubrikës poshtë", async () => {
    const r = await renderScreen(<MoreScreen />);
    await type(r, "nate");
    const text = visibleText(r.root);
    expect(text).toContain(sq.night_title);
    expect(text).toContain(sq.section_prefs);
    expect(text).not.toContain(sq.my_orders);
  });

  it("kërkimi pa rezultat: mesazh i qartë, dhe ✕ e pastron", async () => {
    const r = await renderScreen(<MoreScreen />);
    await type(r, "zzz");
    expect(visibleText(r.root)).toContain(sq.settings_no_results.replace("{q}", "zzz"));
    await act(async () => {
      r.root.findAll((n) => n.props.accessibilityLabel === sq.a11y_close && typeof n.props.onPress === "function")[0].props.onPress();
    });
    expect(search(r).props.value).toBe("");
    expect(visibleText(r.root)).toContain(sq.section_saved);
  });

  it("me një prekje: tema e errët ndizet dhe rreshti “Pamja” e tregon", async () => {
    const r = await renderScreen(<MoreScreen />);
    expect(tile(r, sq.appearance).props.accessibilityState).toEqual({ checked: false });
    await act(async () => {
      tile(r, sq.appearance).props.onPress();
    });
    expect(tile(r, sq.appearance).props.accessibilityState).toEqual({ checked: true });
    expect(visibleText(r.root).filter((s) => s === sq.appearance_dark).length).toBeGreaterThanOrEqual(2);
  });

  it("qendra e kontrollit: modaliteti i natës ndizet menjëherë dhe hapet (jo vetëm orari)", async () => {
    const r = await renderScreen(<MoreScreen />);
    expect(tile(r, sq.night_title).props.accessibilityState).toEqual({ checked: false });
    await act(async () => {
      tile(r, sq.night_title).props.onPress();
    });
    expect(tile(r, sq.night_title).props.accessibilityState).toEqual({ checked: true });
    expect(router().navigate).toHaveBeenCalledWith("/(main)/baby");
    await act(async () => {
      tile(r, sq.night_title).props.onPress();
    });
    expect(tile(r, sq.night_title).props.accessibilityState).toEqual({ checked: false });
  });

  it("pa “Kujdesi për ty” (u hoq më 15 tetor)", async () => {
    const r = await renderScreen(<MoreScreen />);
    expect(visibleText(r.root)).not.toContain(sq.care_title);
  });

  it("me një prekje: gjuha kalon në anglisht dhe kthehet", async () => {
    const r = await renderScreen(<MoreScreen />);
    await act(async () => {
      tile(r, sq.language).props.onPress();
    });
    expect(visibleText(r.root)[0]).toBe(en.nav_more);
    await act(async () => {
      tile(r, en.language).props.onPress();
    });
    expect(visibleText(r.root)[0]).toBe(sq.nav_more);
  });
});
