import { renderScreen, visibleText } from "./helpers/screen";
import { act } from "react-test-renderer";
import { MessagesSquare } from "lucide-react-native";
import { ComposerPrompt, FeedEmpty, FeedSkeleton } from "@/components/community/FeedParts";
import { PostMediaGrid } from "@/components/community/PostMediaGrid";
import { expertsFirst } from "@/app/(main)/community/post/[id]";

describe("pjesët e rrjedhës së komunitetit", () => {
  it("“Ndaj diçka…”: fusha dhe butoni i fotos hapin shkrimin e postimit", async () => {
    const open = jest.fn();
    const r = await renderScreen(<ComposerPrompt initial="M" placeholder="Ndaj diçka ose pyet prindërit e tjerë…" photoLabel="Shto foto në postim" onPress={open} />);
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["M", "Ndaj diçka ose pyet prindërit e tjerë…"]));
    const buttons = r.root.findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function", { deep: false });
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(["Ndaj diçka ose pyet prindërit e tjerë…", "Shto foto në postim"]);
    for (const b of buttons) await act(async () => b.props.onPress());
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("gjendja bosh: titull, shpjegim dhe një veprim; pa veprim s'ka buton", async () => {
    const go = jest.fn();
    const r = await renderScreen(<FeedEmpty icon={MessagesSquare} title="Pa postime ende" sub="Bëhu i pari që shkruan." action="Shkruaj postim" onAction={go} />);
    expect(visibleText(r.root)).toEqual(["Pa postime ende", "Bëhu i pari që shkruan.", "Shkruaj postim"]);
    await act(async () => r.root.findAll((n) => n.props.accessibilityRole === "button", { deep: false })[0].props.onPress());
    expect(go).toHaveBeenCalled();
    const plain = await renderScreen(<FeedEmpty icon={MessagesSquare} title="A" sub="B" />);
    expect(plain.root.findAll((n) => n.props.accessibilityRole === "button")).toHaveLength(0);
  });

  it("skeleti i ngarkimit s'lexohet nga lexuesi i ekranit dhe ndalet kur hiqet", async () => {
    const r = await renderScreen(<FeedSkeleton />);
    expect(r.root.findAll((n) => n.props.importantForAccessibility === "no-hide-descendants").length).toBeGreaterThan(0);
    expect(visibleText(r.root)).toEqual([]);
    await act(async () => r.unmount());
  });
});

describe("postimi i hapur", () => {
  const img = (n: number) => ({ type: "image" as const, path: `p${n}.jpg`, url: `https://x.test/p${n}.jpg`, width: 800, height: 600 });

  it("komentet: përgjigjet e mjekëve dalin të parat, të tjerat ruajnë radhën", () => {
    const c = (id: string, expert: boolean) => ({ id, expert: expert ? { specialty: "pediatrics", kind: "doctor" } : null }) as never;
    expect(expertsFirst([c("a", false), c("b", true), c("c", false), c("d", true)]).map((x: { id: string }) => x.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("te detajet fotoja hapet në ekran të plotë dhe mbyllet; te rrjedha hap postimin", async () => {
    const r = await renderScreen(<PostMediaGrid media={[img(1), img(2), img(3)] as never} interactive />);
    const tiles = r.root.findAll((n) => n.props.accessibilityRole === "imagebutton" && typeof n.props.onPress === "function", { deep: false });
    expect(tiles.map((x) => x.props.accessibilityLabel)).toEqual(["Hap foton 1 nga 3", "Hap foton 2 nga 3", "Hap foton 3 nga 3"]);
    const modal = () => r.root.findAll((n) => typeof n.props.onRequestClose === "function" && "visible" in n.props)[0];
    expect(modal().props.visible).toBe(false);
    await act(async () => tiles[1].props.onPress());
    expect(modal().props.visible).toBe(true);
    expect(visibleText(r.root).join(" ")).toMatch(/2 \/ 3/);
    const close = r.root.findAll((n) => n.props.accessibilityLabel === "Mbyll foton" && typeof n.props.onPress === "function")[0];
    await act(async () => close.props.onPress());
    expect(modal().props.visible).toBe(false);

    const open = jest.fn();
    const feed = await renderScreen(<PostMediaGrid media={[img(1)] as never} onPress={open} />);
    const one = feed.root.findAll((n) => n.props.accessibilityRole === "image" && typeof n.props.onPress === "function", { deep: false })[0];
    await act(async () => one.props.onPress());
    expect(open).toHaveBeenCalled();
  });
});
