/**
 * Rregullimet e 18 tetorit: dritarja nga poshtë mbi tastierë, fotoja e kategorisë pas zgjedhjes/heqjes, dhe karta e
 * re e postimit (eksperti i verifikuar, "Lexo më shumë", "M'ndihmoi").
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { Image, Keyboard, Text, View } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PostCard } from "@/components/community/PostCard";
import Shop from "@/app/(main)/shop/index";
import type { CommunityPost } from "@/lib/communityData";

jest.mock("@/components/shop/BrandMarquee", () => ({ BrandMarquee: () => null }));

describe("dritarja nga poshtë", () => {
  it("ngjitet mbi tastierën kur ajo hapet dhe kthehet kur mbyllet", async () => {
    const listeners: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: never) => {
      listeners[event] = cb;
      return { remove: () => {} };
    }) as never);
    const r = await renderScreen(
      <BottomSheet visible onClose={() => {}}>
        <Text>Forma</Text>
      </BottomSheet>
    );
    const outer = () => r.root.findAll((n) => n.type === View && n.props.className === "flex-1 justify-end")[0];
    expect(outer().props.style).toEqual({ paddingBottom: 0 });
    await act(async () => (listeners.keyboardWillShow ?? listeners.keyboardDidShow)({ endCoordinates: { height: 300 } }));
    expect(outer().props.style).toEqual({ paddingBottom: 300 });
    await act(async () => (listeners.keyboardWillHide ?? listeners.keyboardDidHide)({ endCoordinates: { height: 0 } }));
    expect(outer().props.style).toEqual({ paddingBottom: 0 });
  });
});

describe("kategoritë e dyqanit", () => {
  it("fotoja mbetet pas zgjedhjes dhe heqjes së kategorisë", async () => {
    const fake = fakeSupabase();
    fake.tables.categories = [{ id: "c1", key: "Dhoma e bebit", label: "Dhoma e bebit", icon: "home" }];
    fake.tables.products = [];
    fake.tables.brands = [];
    fake.rpc.shop_product_order = () => [];
    const r = await renderScreen(<Shop />);
    await act(async () => { await new Promise((res) => setTimeout(res, 30)); });
    const chip = () => r.root.findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function" && visibleText(n).includes("Dhoma e bebit"))[0];
    const photo = () => chip().findAllByType(Image);
    expect(photo()).toHaveLength(1);
    for (let i = 0; i < 2; i++) await act(async () => { chip().props.onPress(); });
    expect(photo()).toHaveLength(1);
    expect(photo()[0].props.style).toEqual({ width: 72, height: 72 });
  });
});

describe("karta e postimit", () => {
  const post = (over: Partial<CommunityPost> = {}): CommunityPost => ({
    id: "p", authorId: "a", authorName: "Dr. Arta", authorInitial: "A", authorIsExpert: false, authorSpecialty: null,
    accent: "olive", kind: "post", text: "Përshëndetje", tag: null, icon: "comment" as never, groupId: null, groupName: null,
    at: new Date().toISOString(), likeCount: 0, commentCount: 0, liked: false, saved: false, media: [], ...over,
  });

  it("eksperti: reparti te rreshti poshtë emrit dhe shënimi; pa vijën anësore të vjetër", async () => {
    const r = await renderScreen(<PostCard post={post({ authorIsExpert: true, authorSpecialty: "pediatrician" })} onOpen={() => {}} />);
    const text = visibleText(r.root).join(" | ");
    expect(text).toContain("Pediatër");
    expect(text).toContain("Informacion i përgjithshëm");
    expect(r.root.findAll((n) => String(n.props.className ?? "").includes("border-l-"))).toHaveLength(0);
  });

  it("teksti i gjatë pritet me “Lexo më shumë”, që hap postimin", async () => {
    const onOpen = jest.fn();
    const r = await renderScreen(<PostCard post={post({ text: "fjalë ".repeat(80) })} onOpen={onOpen} />);
    const more = r.root.findAll((n: ReactTestInstance) => n.type === Text && visibleText(n).includes("Lexo më shumë"))[0];
    act(() => more.props.onPress());
    expect(onOpen).toHaveBeenCalled();
    expect(visibleText(r.root)).toContain("Lexo më shumë");
    const short = await renderScreen(<PostCard post={post()} onOpen={() => {}} />);
    expect(visibleText(short.root)).not.toContain("Lexo më shumë");
  });

  it("“M'ndihmoi” ndërron gjendjen dhe numrin menjëherë", async () => {
    fakeSupabase().session = { user: { id: "une" } };
    fakeSupabase().tables.community_post_likes = [];
    const r = await renderScreen(<PostCard post={post({ likeCount: 2 })} onOpen={() => {}} />);
    const like = () => r.root.findAll((n) => n.props.accessibilityRole === "button" && String(n.props.accessibilityLabel).startsWith("M'ndihmoi"))[0];
    expect(like().props.accessibilityState).toEqual({ selected: false });
    await act(async () => { like().props.onPress(); });
    expect(like().props.accessibilityState).toEqual({ selected: true });
    expect(like().props.accessibilityLabel).toBe("M'ndihmoi, 3");
  });
});
