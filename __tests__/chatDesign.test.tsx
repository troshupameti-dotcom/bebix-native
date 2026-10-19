/**
 * Biseda e re: mesazhet e njëpasnjëshme të të njëjtit person grupohen (ora vetëm te i fundit), ndarësi "Sot",
 * dhe butoni i dërgimit aktiv vetëm kur ka tekst.
 */
import { fakeSupabase, renderScreen, setParams, visibleText } from "./helpers/screen";
import { TextInput } from "react-native";
import { act } from "react-test-renderer";
import Chat from "@/app/(main)/community/chat/[id]";

jest.mock("expo-screen-capture", () => ({ usePreventScreenCapture: () => {}, addScreenshotListener: () => ({ remove: () => {} }) }));

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const msg = (id: string, sender: string, body: string, minutesAgo: number) => ({
  id, conversation_id: "c", sender_id: sender, body, kind: "text", created_at: at(minutesAgo),
});

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};

beforeEach(() => {
  const fake = fakeSupabase();
  fake.session = { user: { id: "me" } };
  fake.rpc.mark_conversation_read = () => null;
  fake.tables.dm_conversations = { id: "c", user_a: "me", user_b: "ana" };
  fake.rpc.community_public_profile = () => [{ user_id: "ana", display_name: "Ana", followers: 0, following: 0 }];
  fake.rpc.dm_can_send = () => true;
  fake.tables.community_user_profiles = [];
  fake.tables.community_experts = [];
  setParams({ id: "c" });
});

describe("biseda", () => {
  it("grupon mesazhet e njëpasnjëshme: ora del vetëm te i fundit i grupit; ndarësi “Sot”", async () => {
    const fake = fakeSupabase();
    // Më të rejat të parat (siç i kthen serveri).
    fake.tables.dm_messages = [msg("3", "me", "Mirë, faleminderit", 1), msg("2", "ana", "Si je?", 3), msg("1", "ana", "Përshëndetje", 4)];
    const r = await renderScreen(<Chat />);
    await settle();
    const text = visibleText(r.root);
    expect(text).toEqual(expect.arrayContaining(["Ana", "Përshëndetje", "Si je?", "Mirë, faleminderit"]));
    expect(text).toContain("Sot");
    const times = text.filter((s) => /^\d{1,2}:\d{2}/.test(s));
    expect(times).toHaveLength(2);
  });

  it("dërgimi: butoni aktiv vetëm me tekst", async () => {
    const fake = fakeSupabase();
    fake.tables.dm_messages = [];
    const r = await renderScreen(<Chat />);
    await settle();
    const send = () => r.root.findAll((n) => n.props.accessibilityLabel === "Dërgo" && typeof n.props.onPress === "function")[0];
    expect(send().props.accessibilityState).toEqual({ disabled: true });
    await act(async () => r.root.findByType(TextInput).props.onChangeText("Tung"));
    expect(send().props.accessibilityState).toEqual({ disabled: false });
  });
});
