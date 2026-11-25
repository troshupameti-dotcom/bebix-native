/**
 * "S'kam ende fëmijë": llogaria pa bebe sheh kreun e thjeshtë (pa shënime, gjumë apo dhëmbë të një bebi që s'ekziston)
 * dhe "Shto fëmijë" hap dritaren e fëmijës së ri.
 */
import { fakeSupabase, renderScreen, router, visibleText } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BabyHome from "@/app/(main)/baby/index";
import { __resetChildrenStoreForTests, setChildrenState } from "@/lib/children/store";

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};
const press = (root: ReactTestInstance, label: string) =>
  act(async () => {
    const hits = root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).includes(label));
    hits[hits.length - 1].props.onPress();
  });

beforeEach(async () => {
  __resetChildrenStoreForTests();
  fakeSupabase().tables.children = [];
});

it("pa fëmijë: kreu i thjeshtë, pa pjesët e bebit", async () => {
  await AsyncStorage.setItem("bebix_children_v1", JSON.stringify({ activeChildId: null, children: [], isPremium: false }));
  await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { parentName: "Gjyshja Ana", babyName: null } }));
  // Serveri u përgjigj: familja s'ka asnjë fëmijë.
  setChildrenState({ mode: "legacy", children: [], activeChildId: null });
  const r = await renderScreen(<BabyHome />);
  await settle();
  const text = visibleText(r.root);
  expect(text).toEqual(expect.arrayContaining(["Mirë se erdhe në TROA", "Kur të vijë bebi", "Dyqani TROA", "Përrallë për sonte"]));
  expect(text.some((x) => x.includes("Gjyshja"))).toBe(true);
  for (const baby of ["Bebi", "Ushqyerje", "Gjumë", "Pelenë", "Dhëmbët", "Vaksinat"]) expect(text).not.toContain(baby);
  await press(r.root, "Kur të vijë bebi");
  expect(router().push).toHaveBeenCalledWith({ pathname: "/(main)/more/children", params: { add: "1" } });
});

it("me bebe (emri në profil): kreu i zakonshëm", async () => {
  setChildrenState({ mode: "legacy", children: [], activeChildId: null });
  await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { parentName: "Mami", babyName: "Ana" } }));
  const r = await renderScreen(<BabyHome />);
  await settle();
  expect(visibleText(r.root)).not.toContain("Mirë se erdhe në TROA");
});
