/**
 * Rregullimet e 19 tetorit: emri dhe datëlindja e regjistrimit dalin te Cilësimet e bebit, datëlindja e detyrueshme,
 * profili i komunitetit me emrin publik dhe foton, hashtag-ët funksionalë, listat e ndjekjes vetëm për miqtë.
 */
import { fakeSupabase, renderScreen, router, setParams, visibleText } from "./helpers/screen";
import { Image, Text, TextInput } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";
import CreateProfile from "@/app/(auth)/create-profile";
import BabySettings from "@/app/(main)/baby/settings";
import MyProfile from "@/app/(main)/community/profile";
import Follows from "@/app/(main)/community/follows";
import { PostCard } from "@/components/community/PostCard";
import { useAppState } from "@/lib/state/AppStateContext";
import { __resetAvatarsForTests } from "@/lib/community/avatars";
import type { CommunityPost } from "@/lib/communityData";

const press = (root: ReactTestInstance, label: string) =>
  act(async () => {
    const hits = root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).includes(label));
    hits[hits.length - 1].props.onPress();
  });
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};

beforeEach(() => __resetAvatarsForTests());

describe("regjistrimi", () => {
  it("pa datëlindje s'kalohet më tej; emri dhe data ruhen edhe në telefon", async () => {
    let profile: { babyName: string | null; babyDob: string | null } | null = null;
    function Probe() {
      profile = useAppState().state.profile;
      return null;
    }
    const r = await renderScreen(<><CreateProfile /><Probe /></>);
    const type = async (v: string) => act(async () => { r.root.findByType(TextInput).props.onChangeText(v); });
    await type("Ana");
    await press(r.root, "Vazhdo");
    await type("Mami");
    await press(r.root, "Vazhdo");
    await press(r.root, "Vazhdo");
    expect(visibleText(r.root)).toContain("Shkruaj datëlindjen e bebit për të vazhduar.");
    await type("10032025");
    await press(r.root, "Vazhdo");
    await press(r.root, "Krijo llogarinë");
    expect(profile!.babyName).toBe("Ana");
    expect(new Date(profile!.babyDob as string).getDate()).toBe(10);
  });
});

describe("Cilësimet e bebit", () => {
  it("emri dhe data që vijnë pasi hapet ekrani dalin te fushat (pa i mbishkruar ndryshimet e prindit)", async () => {
    let update: ((v: { babyName?: string; babyDob?: string }) => void) | null = null;
    function Probe() {
      update = useAppState().updateProfile;
      return null;
    }
    const r = await renderScreen(<><BabySettings /><Probe /></>);
    const inputs = () => r.root.findAllByType(TextInput);
    expect(inputs()[0].props.value).toBe("");
    await act(async () => update!({ babyName: "Ana", babyDob: new Date(2025, 2, 10).toISOString() }));
    expect(inputs()[0].props.value).toBe("Ana");
    expect(visibleText(r.root).join(" ")).toMatch(/2025/);
    // Prindi e ndryshon vetë: një përditësim tjetër nga serveri s'e prek.
    await act(async () => inputs()[0].props.onChangeText("Ana Maria"));
    await act(async () => update!({ babyName: "Ana B." }));
    expect(inputs()[0].props.value).toBe("Ana Maria");
  });
});

const post = (over: Partial<CommunityPost> = {}): CommunityPost => ({
  id: "p", authorId: "a1", authorName: "Ana", authorInitial: "A", authorIsExpert: false, authorSpecialty: null,
  accent: "olive", kind: "post", text: "Përshëndetje", tag: "Gjumi", icon: "comment" as never, groupId: null, groupName: null,
  at: new Date().toISOString(), likeCount: 0, commentCount: 0, liked: false, saved: false, media: [], ...over,
});

describe("komuniteti", () => {
  it("fotoja e autorit lexohet nga profili (edhe për postimet e vjetra); pa foto: shkronja", async () => {
    fakeSupabase().tables.community_user_profiles = [{ user_id: "a1", avatar_path: "a1/avatar-2.jpg" }];
    fakeSupabase().tables.community_experts = [];
    const r = await renderScreen(<PostCard post={post()} onOpen={() => {}} />);
    await settle();
    expect(r.root.findAllByType(Image).length).toBeGreaterThan(0);
  });

  it("hashtag-u hap feed-in me atë temë", async () => {
    const r = await renderScreen(<PostCard post={post()} onOpen={() => {}} />);
    await act(async () => r.root.findAll((n) => n.props.accessibilityLabel === "#Gjumi" && typeof n.props.onPress === "function")[0].props.onPress());
    expect(router().push).toHaveBeenLastCalledWith({ pathname: "/community", params: { topic: "Gjumi" } });
  });

  it("tema e ruajtur me “#” (si nga Postim i ri) del me një “#”, jo “##”", async () => {
    const r = await renderScreen(<PostCard post={post({ tag: "#gjumiibebit" })} onOpen={() => {}} />);
    const text = r.root.findAll((n) => typeof n.props.children === "string" && n.props.children.includes("gjumiibebit")).map((n) => n.props.children);
    expect(text).toContain("#gjumiibebit");
    expect(text.some((s: string) => s.startsWith("##"))).toBe(false);
  });

  it("“Profili im” përdor emrin publik (si te postimet), me Postime · Ndjekës · Të ndjekur", async () => {
    const fake = fakeSupabase();
    fake.session = { user: { id: "me" } };
    fake.rpc.community_public_profile = () => [{ user_id: "me", display_name: "Dr. Arta", expert_id: null, followers: 4, following: 2 }];
    fake.tables.community_feed = [];
    fake.tables.community_experts = [];
    fake.tables.community_user_profiles = [];
    const r = await renderScreen(<MyProfile />);
    await settle();
    const text = visibleText(r.root);
    expect(text).toContain("Dr. Arta");
    expect(text).toEqual(expect.arrayContaining(["Ndjekës", "Të ndjekur", "4", "2"]));
  });

  it("listat e ndjekjes: jo-miku sheh vetëm shënimin", async () => {
    const fake = fakeSupabase();
    fake.rpc.community_can_see_follows = () => false;
    fake.rpc.community_follow_list = () => [];
    setParams({ user: "x", kind: "followers", name: "Ana" });
    const r = await renderScreen(<Follows />);
    await settle();
    expect(visibleText(r.root)).toContain("Listat i shohin vetëm miqtë: kur ndiqni njëri-tjetrin.");
  });

  it("listat e ndjekjes: miku sheh emrat", async () => {
    const fake = fakeSupabase();
    fake.rpc.community_can_see_follows = () => true;
    fake.rpc.community_follow_list = () => [{ user_id: "b", display_name: "Ben" }];
    setParams({ user: "x", kind: "followers", name: "Ana" });
    const r = await renderScreen(<Follows />);
    await settle();
    expect(r.root.findAll((n) => n.type === Text && visibleText(n).includes("Ben")).length).toBeGreaterThan(0);
  });
});
