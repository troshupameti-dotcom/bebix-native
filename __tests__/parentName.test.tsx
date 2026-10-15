/**
 * Emri i prindit te Cilësimet: ruhet në telefon menjëherë (edhe pa rrjet), dërgohet te serveri, kthehet pas
 * daljes/hyrjes ose në telefon tjetër, dhe ndryshimi i padërguar s'mbishkruhet nga versioni i vjetër i serverit.
 * Më parë emri rrinte vetëm në telefon (15 tetor).
 */
import { fakeSupabase, renderScreen } from "./helpers/screen";
import { act } from "react-test-renderer";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppState } from "@/lib/state/AppStateContext";
import { APP_STATE_KEY } from "@/lib/state/persistence";
import { initialAppState } from "@/lib/state/types";
import { isParentNamePending, saveParentNameRemote } from "@/lib/babySync";

const ME = { user: { id: "u1", email: "prindi@bebix.store" } };

function Probe() {
  const { state } = useAppState();
  return <Text testID="name">{state.profile.parentName ?? "-"}</Text>;
}

async function shownName(r: Awaited<ReturnType<typeof renderScreen>>, want: string): Promise<string> {
  let text = "";
  for (let i = 0; i < 40; i++) {
    text = String(r.root.findByProps({ testID: "name" }).props.children);
    if (text === want) return text;
    await act(async () => {
      await new Promise((res) => setTimeout(res, 25));
    });
  }
  return text;
}

const seedLocalName = (name: string) =>
  AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify({ ...initialAppState, profile: { ...initialAppState.profile, parentName: name } }));

describe("emri i prindit", () => {
  it("pa rrjet: s'humbet, shënohet “në pritje” për t'u dërguar më vonë", async () => {
    fakeSupabase().session = ME; // pa tabela: çdo kërkesë dështon si pa rrjet
    expect(await saveParentNameRemote("Arta")).toBe(false);
    expect(await isParentNamePending()).toBe(true);
  });

  it("me rrjet: dërgohet te rreshti i vetë prindit dhe pritja pastrohet", async () => {
    fakeSupabase().session = ME;
    await AsyncStorage.setItem("bebix_parent_name_pending", "1");
    fakeSupabase().tables.baby_profiles = { user_id: "u1", parent_name: "Arta" };
    expect(await saveParentNameRemote("Arta")).toBe(true);
    expect(await isParentNamePending()).toBe(false);
    expect(fakeSupabase().calls.some((c) => c.kind === "from" && c.name === "baby_profiles")).toBe(true);
  });

  it("pas daljes dhe hyrjes (ose në telefon të ri): emri kthehet nga serveri", async () => {
    fakeSupabase().session = ME;
    fakeSupabase().tables.baby_profiles = { user_id: "u1", parent_name: "Arta Krasniqi", baby_name: null, baby_dob: null };
    const r = await renderScreen(<Probe />);
    expect(await shownName(r, "Arta Krasniqi")).toBe("Arta Krasniqi");
  });

  it("ndryshimi i bërë pa rrjet s'mbishkruhet nga versioni i vjetër i serverit; dërgohet kur ka rrjet", async () => {
    fakeSupabase().session = ME;
    await seedLocalName("Meti");
    await AsyncStorage.setItem("bebix_parent_name_pending", "1");
    fakeSupabase().tables.baby_profiles = { user_id: "u1", parent_name: "Emri i vjetër", baby_name: null, baby_dob: null };
    const r = await renderScreen(<Probe />);
    await act(async () => {
      await new Promise((res) => setTimeout(res, 300));
    });
    expect(String(r.root.findByProps({ testID: "name" }).props.children)).toBe("Meti");
    expect(await isParentNamePending()).toBe(false);
  });
});
